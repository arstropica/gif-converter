import { Film, History } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const location = useLocation();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">GIF Converter</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Button
              variant={location.pathname === "/" ? "secondary" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/" className={cn("flex items-center gap-2")}>
                <Film className="h-4 w-4" />
                Convert
              </Link>
            </Button>

            <Button
              variant={location.pathname === "/history" ? "secondary" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/history" className={cn("flex items-center gap-2")}>
                <History className="h-4 w-4" />
                History
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
