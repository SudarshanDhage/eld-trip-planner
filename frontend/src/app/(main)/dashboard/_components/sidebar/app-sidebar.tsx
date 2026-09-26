"use client";

import Link from "next/link";

import { ShieldCheck, Truck } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

const currentUser = {
  name: "SudarshanDhage",
  email: "sudarshandhage@example.com",
  avatar: "",
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.values.sidebar_variant,
      sidebarCollapsible: s.values.sidebar_collapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link prefetch={false} href="/dashboard/logistics" className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                  <Truck className="size-4.5" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold text-base tracking-tight text-foreground">{APP_CONFIG.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                    ELD Dispatch
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarItems} />
      </SidebarContent>
      <SidebarFooter className="p-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-xs group-data-[collapsible=icon]:hidden">
          <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-foreground">FMCSA Part 395</span>
            <span className="text-[10px] text-muted-foreground">70hr/8day HOS Rule</span>
          </div>
        </div>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
