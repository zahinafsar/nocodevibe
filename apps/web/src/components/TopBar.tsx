import { useNavigate } from "react-router-dom";
import { Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDrawer } from "../contexts/DrawerContext";
import iconSvg from "../assets/icon.svg";

export function TopBar() {
  const navigate = useNavigate();
  const { toggle } = useDrawer();

  return (
    <header className="flex items-center justify-between h-12 px-3 bg-card border-b shrink-0">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sessions</TooltipContent>
        </Tooltip>
        <img src={iconSvg} alt="Coodeen" className="h-7 w-auto" />
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
