"use client";

import React, { useState } from "react";
import { AlertTriangle, ShieldCheck, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMissionStore } from "@/stores/mission-store";

export const ApprovalModal: React.FC = () => {
  const { approvals, respondToApproval } = useMissionStore();
  const [note, setNote] = useState("");

  const pendingApproval = approvals.find((a) => a.status === "PENDING");

  if (!pendingApproval) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-lg bg-surfaceRaised border border-warning/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-warning/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                HUMAN APPROVAL REQUIRED
              </div>
              <div className="text-[10px] font-mono text-mutedForeground">
                Requested by: {pendingApproval.requestedByRole}
              </div>
            </div>
          </div>
          <Badge variant="danger" size="sm">
            RISK: {pendingApproval.risk}
          </Badge>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 font-mono text-xs">
          <div>
            <div className="text-[10px] text-mutedForeground uppercase font-semibold mb-1">
              Proposed Action
            </div>
            <div className="text-sm font-semibold text-foreground font-sans">
              {pendingApproval.actionTitle}
            </div>
            <p className="text-xs text-mutedForeground mt-1 leading-relaxed">
              {pendingApproval.description}
            </p>
          </div>

          <div className="p-3 rounded bg-surface border border-border">
            <div className="text-[10px] text-mutedForeground uppercase font-semibold mb-1">
              Reason / Assessment
            </div>
            <p className="text-xs text-foreground">
              {pendingApproval.reason}
            </p>
          </div>

          <div>
            <label className="text-[10px] text-mutedForeground uppercase font-semibold block mb-1.5">
              Reviewer Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Verified schema migration idempotency"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-surface border border-border focus:border-accent rounded px-3 py-2 text-xs text-foreground placeholder:text-mutedForeground focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 bg-surface border-t border-border flex items-center justify-between">
          <div className="text-[10px] font-mono text-mutedForeground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Audit trail preserved</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="md"
              onClick={() => respondToApproval(pendingApproval.id, false, note)}
              icon={<X className="w-3.5 h-3.5" />}
            >
              REJECT
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => respondToApproval(pendingApproval.id, true, note)}
              icon={<Check className="w-3.5 h-3.5" />}
            >
              APPROVE & PROCEED
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
