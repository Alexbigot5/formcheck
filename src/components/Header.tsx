import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const handleSignOut = async () => {
    try {
      logout();
      toast.success("Signed out");
      navigate("/");
    } catch (error: any) {
      toast.error("Sign out failed", { description: error.message });
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        {!isAuthenticated && (
          <a href="/" className="text-base font-semibold text-foreground">
            SmartForms AI
          </a>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Account menu">
                  {user?.email || user?.name || "User"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50">
                <DropdownMenuItem asChild>
                  <a href="/dashboard">Dashboard</a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm">
              <a href="/register" aria-label="Log in or Sign up to SmartForms AI">Log in / Sign up</a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
