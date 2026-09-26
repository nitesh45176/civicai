import React from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Building2,
  Calendar,
  ArrowRight,
  Camera,
  Clock3,
  AlertTriangle,
} from "lucide-react";

import { StatusBadge } from "./StatusBadge";
import { SeverityBadge } from "./SeverityBadge";
import { formatRelativeTime } from "../utils/formatters";
import { cn } from "../utils/cn";

export function ComplaintCard({
  complaint,
  linkPrefix = "/complaints",
  className,
}) {
  if (!complaint) return null;

  // ---------------------------------------------------------
  // Support both normalized frontend fields and backend fields
  // ---------------------------------------------------------

  const complaintId =
    complaint.complaint_id ||
    complaint.complaintId ||
    complaint.id ||
    "N/A";

  const title =
    complaint.title ||
    complaint.complaint_title ||
    "Untitled complaint";

  const description =
    complaint.description ||
    complaint.complaint_description ||
    complaint.ai_description ||
    "";

  const issueType =
    complaint.issueType ||
    complaint.issue_type ||
    "";

  const category = complaint.category || "Other";

  const severity =
    complaint.severity ||
    "Medium";

  const status =
    complaint.status ||
    "SUBMITTED";

  const safetyRisk =
    complaint.safetyRisk ??
    complaint.safety_risk ??
    false;

  const authority =
    typeof complaint.authority === "object"
      ? complaint.authority?.name
      : complaint.authority;

  const locationAddress =
    complaint.location?.address ||
    complaint.location_text ||
    "Location unavailable";

  const createdAt =
    complaint.createdAt ||
    complaint.created_at;

  const image =
    complaint.image ||
    complaint.image_url ||
    null;

  const resolutionImage =
    complaint.resolutionImage ||
    complaint.resolution_image_url ||
    null;

  // ---------------------------------------------------------
  // SLA
  // ---------------------------------------------------------

  const slaDeadline =
    complaint.sla_deadline ||
    complaint.slaDeadline ||
    null;

  const backendHoursRemaining =
    complaint.hours_remaining ??
    complaint.hoursRemaining ??
    null;

  const backendSlaStatus =
    complaint.sla_status ||
    complaint.slaStatus ||
    null;

  let hoursRemaining = backendHoursRemaining;
  let slaStatus = backendSlaStatus;

  if (slaDeadline && hoursRemaining === null) {
    const deadline = new Date(slaDeadline);
    const now = new Date();

    if (!Number.isNaN(deadline.getTime())) {
      const diffMs = deadline.getTime() - now.getTime();
      hoursRemaining = Math.ceil(diffMs / (1000 * 60 * 60));
    }
  }

  if (slaStatus === null && slaDeadline) {
    if (hoursRemaining < 0) {
      slaStatus = "OVERDUE";
    } else if (hoursRemaining <= 24) {
      slaStatus = "AT_RISK";
    } else {
      slaStatus = "ON_TRACK";
    }
  }

  const hasSla = Boolean(slaDeadline);

  const isOverdue =
    slaStatus === "OVERDUE" ||
    (hasSla &&
      typeof hoursRemaining === "number" &&
      hoursRemaining < 0);

  const isAtRisk =
    !isOverdue &&
    (
      slaStatus === "AT_RISK" ||
      (
        hasSla &&
        typeof hoursRemaining === "number" &&
        hoursRemaining <= 24
      )
    );

  const isResolved = status === "RESOLVED";

  // ---------------------------------------------------------
  // SLA badge
  // ---------------------------------------------------------

  let slaBadge = null;

  if (isResolved) {
    slaBadge = (
      <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Clock3 className="w-3 h-3" />
        <span>SLA Closed</span>
      </span>
    );
  } else if (isOverdue) {
    slaBadge = (
      <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
        <AlertTriangle className="w-3 h-3" />
        <span>
          Overdue
          {typeof hoursRemaining === "number"
            ? ` by ${Math.abs(hoursRemaining)}h`
            : ""}
        </span>
      </span>
    );
  } else if (typeof hoursRemaining === "number") {
    const displayHours = Math.max(0, hoursRemaining);

    slaBadge = (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full border",
          isAtRisk
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        )}
      >
        <Clock3 className="w-3 h-3" />
        <span>{displayHours}h remaining</span>
      </span>
    );
  }

  // ---------------------------------------------------------
  // Card
  // ---------------------------------------------------------

  return (
    <Link
      to={`${linkPrefix}/${complaint.id}`}
      className={cn(
        "group block bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:border-slate-300 hover:shadow-md transition-all duration-200 relative overflow-hidden",
        className
      )}
    >
      {/* High severity subtle accent strip */}
      {(severity === "High" || severity === "HIGH" ||
        severity === "Critical" || severity === "CRITICAL") && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 group-hover:w-1.5 transition-all" />
      )}

      {/* Overdue accent */}
      {isOverdue && !isResolved && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500" />
      )}

      <div className="flex flex-col sm:flex-row sm:items-start gap-4">

        {/* -------------------------------------------------
            Thumbnail
        ------------------------------------------------- */}
        {image && (
          <div className="w-full sm:w-28 h-36 sm:h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/70 relative">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />

            {issueType && (
              <span className="absolute bottom-1.5 left-1.5 text-2xs font-mono font-medium px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white">
                {issueType}
              </span>
            )}
          </div>
        )}

        {/* -------------------------------------------------
            Details
        ------------------------------------------------- */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">

          <div>

            {/* Top row */}
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">

              {/* ID + Category */}
              <div className="flex items-center gap-2 min-w-0">

                <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                  {complaintId}
                </span>

                <span className="text-2xs text-slate-400 font-medium hidden sm:inline">
                  &bull;
                </span>

                <span className="text-xs text-slate-500 font-medium truncate max-w-[140px]">
                  {category}
                </span>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">

                {/* SLA */}
                {slaBadge}

                {/* Photo proof */}
                {(isResolved || resolutionImage) && (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Camera className="w-3 h-3 text-emerald-600" />
                    <span>Photo Proof</span>
                  </span>
                )}

                {/* Severity */}
                <SeverityBadge
                  severity={severity}
                  safetyRisk={safetyRisk}
                  size="sm"
                />

                {/* Status */}
                <StatusBadge
                  status={status}
                  size="sm"
                />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1.5">
              {title}
            </h3>

            {/* Description */}
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
              {description}
            </p>
          </div>

          {/* -------------------------------------------------
              Footer
          ------------------------------------------------- */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-2xs text-slate-500 flex-wrap">

            <div className="flex items-center gap-3 flex-wrap">

              {/* Authority */}
              {authority && (
                <div className="flex items-center gap-1 text-slate-600">
                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />

                  <span className="truncate max-w-[180px] font-medium">
                    {authority}
                  </span>
                </div>
              )}

              {/* Location */}
              <div className="flex items-center gap-1 text-slate-500">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />

                <span className="truncate max-w-[180px]">
                  {locationAddress}
                </span>
              </div>
            </div>

            {/* Time + Arrow */}
            <div className="flex items-center gap-2">

              <div className="flex items-center gap-1 text-slate-400">
                <Calendar className="w-3 h-3 shrink-0" />

                <span>
                  {createdAt
                    ? formatRelativeTime(createdAt)
                    : "Recently"}
                </span>
              </div>

              <ArrowRight
                className="
                  w-3.5 h-3.5
                  text-slate-400
                  group-hover:text-blue-600
                  group-hover:translate-x-0.5
                  transition-all
                  shrink-0
                "
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}