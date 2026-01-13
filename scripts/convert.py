#!/usr/bin/env python3
"""
GIF Converter CLI

Convert videos and images to GIFs using the gif-converter API.

Usage:
    ./convert.py input.mp4 -o output.gif
    ./convert.py input.mp4 --width 320 --fps 15
    ./convert.py input.mp4 --url-only
"""

import argparse
import json
import os
import sys
import time
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)

try:
    import websocket
    HAS_WEBSOCKET = True
except ImportError:
    HAS_WEBSOCKET = False

DEFAULT_BASE_URL = "http://localhost:5051"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert videos and images to GIFs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s video.mp4                     Convert with defaults
    %(prog)s video.mp4 -o output.gif       Convert and save to file
    %(prog)s video.mp4 --width 320         Resize to 320px width
    %(prog)s video.mp4 --fps 15            Set output framerate
    %(prog)s video.mp4 --rotate 90         Rotate 90° clockwise
    %(prog)s video.mp4 --url-only          Just print download URL
    %(prog)s video.mp4 --compress          Enable gif-compressor
        """
    )

    # Required
    parser.add_argument("input", help="Input video or image file")

    # Output options
    parser.add_argument("-o", "--output", help="Output file path (downloads the result)")
    parser.add_argument("--url-only", action="store_true",
                        help="Print download URL instead of downloading")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL,
                        help=f"API base URL (default: {DEFAULT_BASE_URL})")

    # Dimension options
    parser.add_argument("--width", type=int, help="Output width (auto if not set)")
    parser.add_argument("--height", type=int, help="Output height (auto if not set)")

    # Rotation
    parser.add_argument("--rotate", type=int, choices=[0, 90, 180, 270],
                        default=0, help="Rotation in degrees clockwise")

    # Frame rate options
    parser.add_argument("--input-fps", type=float,
                        help="Override input frame rate")
    parser.add_argument("--fps", "--output-fps", type=float, dest="output_fps",
                        help="Output frame rate")
    parser.add_argument("--interpolate", type=float, dest="minterpolate_fps",
                        help="Motion interpolation FPS (slow, for smooth slow-mo)")

    # Background options
    parser.add_argument("--bg-color", help="Background color (hex or name, e.g., #ffffff, black)")
    parser.add_argument("--bg-image", help="Background image file path")

    # Compression
    parser.add_argument("--compress", action="store_true",
                        help="Send to gif-compressor after conversion")

    # Other
    parser.add_argument("--no-progress", action="store_true",
                        help="Disable progress output")
    parser.add_argument("--timeout", type=int, default=300,
                        help="Timeout in seconds (default: 300)")

    return parser.parse_args()


def rotate_to_transpose(degrees: int) -> int:
    """Convert rotation degrees to ffmpeg transpose value."""
    return {0: 0, 90: 1, 270: 2, 180: 3}.get(degrees, 0)


def format_bytes(size: int) -> str:
    """Format bytes as human-readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def print_progress(status: str, progress: int, current_pass: int = 0, end: str = "\r"):
    """Print progress bar to terminal."""
    bar_width = 30
    filled = int(bar_width * progress / 100)
    bar = "█" * filled + "░" * (bar_width - filled)

    pass_info = f" (Pass {current_pass}/3)" if current_pass > 0 else ""
    sys.stdout.write(f"\r{status}{pass_info}: [{bar}] {progress}%{' ' * 10}{end}")
    sys.stdout.flush()


def wait_for_completion(base_url: str, job_id: str, show_progress: bool, timeout: int) -> dict:
    """Poll job status until completion or failure."""
    api_url = urljoin(base_url, f"/api/jobs/{job_id}")
    start_time = time.time()
    last_status = ""

    while True:
        if time.time() - start_time > timeout:
            raise TimeoutError(f"Job timed out after {timeout} seconds")

        response = requests.get(api_url)
        response.raise_for_status()
        job = response.json()

        status = job.get("status", "unknown")
        progress = job.get("progress", 0)
        current_pass = job.get("current_pass", 0)

        if show_progress:
            status_display = {
                "uploading": "Uploading",
                "queued": "Queued",
                "processing": "Processing",
                "compressing": "Compressing",
                "completed": "Completed",
                "failed": "Failed"
            }.get(status, status.title())
            print_progress(status_display, progress, current_pass)

        if status == "completed":
            if show_progress:
                print_progress("Completed", 100, end="\n")
            return job
        elif status == "failed":
            if show_progress:
                print()
            error_msg = job.get("error_message", "Unknown error")
            raise RuntimeError(f"Conversion failed: {error_msg}")

        time.sleep(0.5)


def upload_file(base_url: str, file_path: str, options: dict,
                bg_image_path: str = None, show_progress: bool = True) -> str:
    """Upload file and return job ID."""
    # Use the legacy upload endpoint which handles everything in one request
    url = urljoin(base_url, "/api/upload")

    files = {
        "files": (os.path.basename(file_path), open(file_path, "rb"))
    }

    if bg_image_path and os.path.exists(bg_image_path):
        files["background"] = (os.path.basename(bg_image_path), open(bg_image_path, "rb"))

    data = {
        "options": json.dumps(options)
    }

    if show_progress:
        print(f"Uploading {os.path.basename(file_path)}...")

    response = requests.post(url, files=files, data=data)

    # Close file handles
    for f in files.values():
        f[1].close()

    if not response.ok:  # Accept any 2xx status code
        try:
            error = response.json().get("error", response.text)
        except:
            error = response.text
        raise RuntimeError(f"Upload failed: {error}")

    result = response.json()
    jobs = result.get("jobs", [])

    if not jobs:
        raise RuntimeError("No job created")

    return jobs[0]["id"]


def download_file(base_url: str, job_id: str, output_path: str, show_progress: bool = True):
    """Download converted GIF to file."""
    url = urljoin(base_url, f"/api/download/{job_id}")

    if show_progress:
        print(f"Downloading to {output_path}...")

    response = requests.get(url, stream=True)
    response.raise_for_status()

    total_size = int(response.headers.get("content-length", 0))
    downloaded = 0

    with open(output_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if show_progress and total_size > 0:
                progress = int(downloaded * 100 / total_size)
                print_progress("Downloading", progress)

    if show_progress:
        print_progress("Downloaded", 100, end="\n")
        print(f"Saved: {output_path} ({format_bytes(os.path.getsize(output_path))})")


def main():
    args = parse_args()

    # Validate input file
    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    # Validate background image if provided
    if args.bg_image and not os.path.exists(args.bg_image):
        print(f"Error: Background image not found: {args.bg_image}", file=sys.stderr)
        sys.exit(1)

    # Build conversion options
    options = {
        "width": args.width,
        "height": args.height,
        "transpose": rotate_to_transpose(args.rotate),
        "input_fps": args.input_fps,
        "output_fps": args.output_fps,
        "minterpolate_fps": args.minterpolate_fps,
        "background_color": args.bg_color,
        "background_image_id": None,  # Handled via file upload
        "compress_output": args.compress,
    }

    show_progress = not args.no_progress

    try:
        # Check server health
        health_url = urljoin(args.base_url, "/api/health")
        try:
            requests.get(health_url, timeout=5)
        except requests.exceptions.ConnectionError:
            print(f"Error: Cannot connect to server at {args.base_url}", file=sys.stderr)
            print("Make sure the gif-converter service is running.", file=sys.stderr)
            sys.exit(1)

        # Upload file
        job_id = upload_file(
            args.base_url,
            args.input,
            options,
            args.bg_image,
            show_progress
        )

        if show_progress:
            print(f"Job created: {job_id}")

        # Wait for completion
        job = wait_for_completion(args.base_url, job_id, show_progress, args.timeout)

        # Generate download URL
        download_url = urljoin(args.base_url, f"/api/download/{job_id}")

        # Handle output
        if args.url_only:
            print(download_url)
        elif args.output:
            download_file(args.base_url, job_id, args.output, show_progress)
        else:
            # Default: generate output filename and download
            input_name = os.path.splitext(os.path.basename(args.input))[0]
            output_path = f"{input_name}-converted.gif"
            download_file(args.base_url, job_id, output_path, show_progress)

        # Print stats
        if show_progress and not args.url_only:
            original_size = job.get("original_size", 0)
            converted_size = job.get("converted_size", 0)
            if original_size and converted_size:
                ratio = converted_size / original_size * 100
                print(f"Size: {format_bytes(original_size)} → {format_bytes(converted_size)} ({ratio:.1f}%)")

            dims = f"{job.get('converted_width', '?')}x{job.get('converted_height', '?')}"
            print(f"Dimensions: {dims}")

    except KeyboardInterrupt:
        print("\nAborted.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
