import { useState } from "react";
import { useTranslations } from "@/i18n/compat/client";
import { History, RotateCcw, Trash2, Clock, Sparkles, Palette, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet-no-overlay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/useResumeStore";
import {
  useHistoryStore,
  createImmediateSnapshot,
  ResumeSnapshot,
} from "@/store/useHistoryStore";
import { ResumeData } from "@/types/resume";

const LABEL_CONFIG: Record<string, { icon: typeof Clock; color: string }> = {
  auto: { icon: Clock, color: "text-muted-foreground" },
  manual: { icon: Save, color: "text-blue-500" },
  template: { icon: Palette, color: "text-orange-500" },
  "ai-polish": { icon: Sparkles, color: "text-purple-500" },
  "ai-optimize": { icon: Sparkles, color: "text-pink-500" },
};

function SnapshotItem({
  snapshot,
  onRestore,
  onDelete,
  t,
}: {
  snapshot: ResumeSnapshot;
  onRestore: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const config = LABEL_CONFIG[snapshot.label] || LABEL_CONFIG.auto;
  const Icon = config.icon;
  const date = new Date(snapshot.timestamp);

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const isToday = new Date().toDateString() === date.toDateString();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border p-3 transition-colors",
        "border-border/50 hover:border-border hover:bg-accent/30"
      )}
    >
      <div className={cn("mt-0.5 shrink-0", config.color)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {t(`history.label.${snapshot.label}`)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isToday ? timeStr : `${dateStr} ${timeStr}`}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onRestore}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("history.restore")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("history.delete")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </motion.div>
  );
}

export function HistoryPanel() {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const { activeResume, activeResumeId, updateResume } = useResumeStore();
  const { getSnapshots, restoreSnapshot, deleteSnapshot, clearHistory, addSnapshot } =
    useHistoryStore();

  const snapshots = activeResumeId ? getSnapshots(activeResumeId) : [];

  const handleSaveSnapshot = () => {
    if (!activeResume || !activeResumeId) return;
    createImmediateSnapshot(
      activeResumeId,
      activeResume as unknown as Record<string, unknown>,
      "manual"
    );
    toast.success(t("history.saved"));
  };

  const handleRestore = (snapshotId: string) => {
    if (!activeResumeId) return;

    // Save current state before restoring
    if (activeResume) {
      createImmediateSnapshot(
        activeResumeId,
        activeResume as unknown as Record<string, unknown>,
        "auto"
      );
    }

    const data = restoreSnapshot(snapshotId, activeResumeId);
    if (!data) return;

    updateResume(activeResumeId, data as Partial<ResumeData>);
    toast.success(t("history.restored"));
  };

  const handleDelete = (snapshotId: string) => {
    if (!activeResumeId) return;
    deleteSnapshot(snapshotId, activeResumeId);
  };

  const handleClearAll = () => {
    if (!activeResumeId) return;
    clearHistory(activeResumeId);
    toast.success(t("history.cleared"));
  };

  return (
    <>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(true)}
              className="h-9 w-9"
            >
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("history.title")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[340px] sm:w-[380px] p-0 flex flex-col"
        >
          <SheetHeader className="px-4 pt-4 pb-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              {t("history.title")}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {t("history.description")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2 px-4 pb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveSnapshot}
              className="flex-1 text-xs h-8"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {t("history.saveNow")}
            </Button>

            {snapshots.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("history.clearAll")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("history.clearConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("history.clearConfirmDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("history.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>
                      {t("history.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <Separator />

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t("history.empty")}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {t("history.emptyHint")}
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {snapshots.map((snapshot) => (
                    <SnapshotItem
                      key={snapshot.id}
                      snapshot={snapshot}
                      onRestore={() => handleRestore(snapshot.id)}
                      onDelete={() => handleDelete(snapshot.id)}
                      t={t}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>

          {snapshots.length > 0 && (
            <div className="border-t px-4 py-2">
              <p className="text-[10px] text-muted-foreground text-center">
                {t("history.count", { count: snapshots.length })}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
