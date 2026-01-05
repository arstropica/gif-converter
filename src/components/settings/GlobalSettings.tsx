import { RotateCcw, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { TransposeValue } from "@/api/types";
import { useSettingsStore, DEFAULT_OPTIONS } from "@/store/settingsStore";

export function GlobalSettings() {
  const {
    globalOptions,
    setGlobalOptions,
    backgroundImageFile,
    setBackgroundImageFile,
    resetToDefaults,
  } = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="border-t-4 border-t-primary">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-primary">⚙</span>
            Conversion Settings
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dimensions */}
        <div className="space-y-3">
          <Label>Output Dimensions</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input
                type="number"
                placeholder="Auto"
                value={globalOptions.width || ""}
                onChange={(e) =>
                  setGlobalOptions({
                    width: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Height</Label>
              <Input
                type="number"
                placeholder="Auto"
                value={globalOptions.height || ""}
                onChange={(e) =>
                  setGlobalOptions({
                    height: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty for original size. Aspect ratio is preserved.
          </p>
        </div>

        {/* Rotation */}
        <div className="space-y-2">
          <Label>Rotation</Label>
          <Select
            value={String(globalOptions.transpose)}
            onValueChange={(v) =>
              setGlobalOptions({ transpose: parseInt(v, 10) as TransposeValue })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">None</SelectItem>
              <SelectItem value="1">90 Clockwise</SelectItem>
              <SelectItem value="2">90 Counter-clockwise</SelectItem>
              <SelectItem value="3">180</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Frame Rates */}
        <div className="space-y-3">
          <Label>Frame Rates</Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Input FPS</Label>
              <Input
                type="number"
                placeholder="Auto"
                value={globalOptions.input_fps || ""}
                onChange={(e) =>
                  setGlobalOptions({
                    input_fps: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Output FPS</Label>
              <Input
                type="number"
                placeholder="Auto"
                value={globalOptions.output_fps || ""}
                onChange={(e) =>
                  setGlobalOptions({
                    output_fps: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Interpolate
              </Label>
              <Input
                type="number"
                placeholder="Off"
                value={globalOptions.minterpolate_fps || ""}
                onChange={(e) =>
                  setGlobalOptions({
                    minterpolate_fps: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Interpolate uses motion estimation for smoother playback (slow)
          </p>
        </div>

        {/* Background Color */}
        <div className="space-y-2">
          <Label>Background Color</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="#ffffff or color name"
              value={globalOptions.background_color || ""}
              onChange={(e) =>
                setGlobalOptions({
                  background_color: e.target.value || null,
                })
              }
              className="flex-1"
            />
            <Input
              type="color"
              value={globalOptions.background_color || "#ffffff"}
              onChange={(e) =>
                setGlobalOptions({ background_color: e.target.value })
              }
              className="w-12 p-1 h-10"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            For transparent inputs (PNG, WebP)
          </p>
        </div>

        {/* Background Image */}
        <div className="space-y-2">
          <Label>Background Image</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setBackgroundImageFile(file || null);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              {backgroundImageFile
                ? backgroundImageFile.name
                : "Choose image..."}
            </Button>
            {backgroundImageFile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setBackgroundImageFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Upload an image to use as background layer
          </p>
        </div>

        {/* Compress Output */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Compress Output</Label>
            <p className="text-xs text-muted-foreground">
              Send to gif-compressor after conversion
            </p>
          </div>
          <Switch
            checked={globalOptions.compress_output}
            onCheckedChange={(checked) =>
              setGlobalOptions({ compress_output: checked })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
