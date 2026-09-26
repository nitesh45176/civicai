import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Calendar,
  Share2,
  Copy,
  Printer,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  Compass,
  Camera,
  ArrowRight,
  Eye,
  X,
  Maximize2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { SeverityBadge } from "../../components/SeverityBadge";
import { ComplaintTimeline } from "../../components/ComplaintTimeline";
import { LocationCard } from "../../components/LocationCard";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { showToast } from "../../components/Toast";
import { formatDate } from "../../utils/formatters";
import * as api from "../../services/api";

export function ComplaintDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolution Proof viewer state
  const [proofViewMode, setProofViewMode] = useState("split");
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const [citizenFeedback, setCitizenFeedback] = useState(null);

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError(null);

    api.getComplaintById(id)
      .then((res) => {
        if (!isMounted) return;

        if (res.success && res.data) {
          setComplaint(res.data);
        } else {
          setError(
            res.error ||
              `Complaint with ID "${id}" was not found.`
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;

        setError(
          err.message ||
            "Failed to retrieve complaint details."
        );
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    // Listen to updates from authority actions
    const handleUpdate = (event) => {
      const searchId = (id || "")
        .toString()
        .trim()
        .toUpperCase();

      // Check single complaint update
      const single =
        event?.single ||
        (event?.detail &&
        !Array.isArray(event.detail)
          ? event.detail
          : null);

      if (
        single &&
        (single.id || single.complaint_id)
      ) {
        const singleId = (
          single.id ||
          single.complaint_id
        )
          .toString()
          .trim()
          .toUpperCase();

        if (singleId === searchId) {
          if (isMounted) {
            setComplaint(single);
          }
        }
      }

      // Check array update
      const list = Array.isArray(event?.detail)
        ? event.detail
        : Array.isArray(event)
        ? event
        : null;

      if (list) {
        const found = list.find(
          (c) =>
            (c.id ||
              c.complaint_id ||
              "")
              .toString()
              .trim()
              .toUpperCase() === searchId
        );

        if (found && isMounted) {
          setComplaint(found);
        }
      }

      // Always refresh from backend
      api.getComplaintById(id).then((res) => {
        if (
          isMounted &&
          res.success &&
          res.data
        ) {
          setComplaint(res.data);
        }
      });
    };

    window.addEventListener(
      "civicai_complaints_updated",
      handleUpdate
    );

    window.addEventListener(
      "civicai_complaint_updated",
      handleUpdate
    );

    window.addEventListener(
      "storage",
      handleUpdate
    );

    let channel = null;

    if (
      typeof BroadcastChannel !==
      "undefined"
    ) {
      try {
        channel = new BroadcastChannel(
          "civicai_sync"
        );

        channel.onmessage = (msg) => {
          if (
            msg.data?.type ===
              "COMPLAINT_UPDATED" ||
            msg.data?.type ===
              "COMPLAINTS_UPDATED"
          ) {
            handleUpdate({
              detail: msg.data.detail,
              single: msg.data.single,
            });
          }
        };
      } catch (_) {}
    }

    return () => {
      isMounted = false;

      window.removeEventListener(
        "civicai_complaints_updated",
        handleUpdate
      );

      window.removeEventListener(
        "civicai_complaint_updated",
        handleUpdate
      );

      window.removeEventListener(
        "storage",
        handleUpdate
      );

      if (channel) {
        channel.close();
      }
    };
  }, [id]);

  const handleCopyTrackingLink = () => {
    navigator.clipboard?.writeText(
      window.location.href
    );

    showToast({
      title: "Link Copied",
      message: `Tracking link for ${complaint?.id} copied to clipboard.`,
      type: "info",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <LoadingState message="Fetching official civic ticket details..." />
    );
  }

  if (error || !complaint) {
    return (
      <div className="max-w-2xl mx-auto pt-8">
        <ErrorState
          title="Ticket Not Found"
          message={
            error ||
            `Could not find complaint "${id}".`
          }
          onRetry={() =>
            navigate("/complaints")
          }
        />
      </div>
    );
  }

  const resolvedImageSrc =
    complaint.resolutionImage ||
    complaint.resolution_image_url ||
    "";

  // Derive latest officer note from timeline or fallback
  const resolvedTimelineEntry =
    complaint.timeline?.find(
      (t) =>
        (t.stage || "")
          .toUpperCase() === "RESOLVED"
    );

  const latestTimelineEntry =
    complaint.timeline?.[
      complaint.timeline?.length - 1
    ];

  const latestOfficerNote =
    resolvedTimelineEntry?.description ||
    resolvedTimelineEntry?.title ||
    latestTimelineEntry?.description ||
    `Ground remediation successfully completed, tested, and verified by ${complaint.authority} field supervisor.`;

  // ---------------------------------------------------------
  // SLA INFORMATION
  // ---------------------------------------------------------

  const slaStatus =
    complaint.slaStatus ||
    complaint.sla_status ||
    "NO_SLA";

  const hoursRemaining =
    complaint.hoursRemaining ??
    complaint.hours_remaining ??
    null;

  const slaDeadline =
    complaint.slaDeadline ||
    complaint.sla_deadline ||
    null;

  const escalationCount =
    complaint.escalationCount ??
    complaint.escalation_count ??
    0;

  const lastEscalationAt =
    complaint.lastEscalationAt ||
    complaint.last_escalation_at ||
    null;

  const getSlaDisplay = () => {
    switch (slaStatus) {
      case "ON_TRACK":
        return {
          label: "On Track",
          description:
            hoursRemaining !== null
              ? `${hoursRemaining} hours remaining`
              : "Within configured resolution SLA",
          container:
            "bg-emerald-50 border-emerald-200",
          icon:
            "text-emerald-600",
          text:
            "text-emerald-800",
        };

      case "DUE_SOON":
        return {
          label: "Due Soon",
          description:
            hoursRemaining !== null
              ? `${hoursRemaining} hours remaining`
              : "Resolution deadline approaching",
          container:
            "bg-amber-50 border-amber-200",
          icon:
            "text-amber-600",
          text:
            "text-amber-800",
        };

      case "BREACHED":
        return {
          label: "SLA Breached",
          description:
            "The configured resolution deadline has passed.",
          container:
            "bg-red-50 border-red-200",
          icon:
            "text-red-600",
          text:
            "text-red-800",
        };

      case "RESOLVED":
        return {
          label: "Resolved",
          description:
            "Complaint resolution has been recorded.",
          container:
            "bg-emerald-50 border-emerald-200",
          icon:
            "text-emerald-600",
          text:
            "text-emerald-800",
        };

      default:
        return {
          label: "No SLA",
          description:
            "No resolution SLA is configured for this complaint.",
          container:
            "bg-slate-50 border-slate-200",
          icon:
            "text-slate-500",
          text:
            "text-slate-700",
        };
    }
  };

  const slaDisplay = getSlaDisplay();

  const handleCitizenFeedback = (action) => {
    setCitizenFeedback(action);

    if (action === "CONFIRMED") {
      showToast({
        title: "Resolution Confirmed",
        message:
          "Thank you for verifying! Your confirmation has been added to the public civic log.",
        type: "success",
      });
    } else {
      showToast({
        title: "Re-Inspection Requested",
        message:
          "Your dispute has been logged. An audit supervisor will re-examine this location.",
        type: "warning",
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Top Header */}
      <PageHeader
        title={complaint.id}
        badge={
          <StatusBadge
            status={complaint.status}
            size="md"
          />
        }
        description={`Filed on ${formatDate(
          complaint.createdAt
        )} &bull; ${complaint.category}`}
        backTo="/complaints"
        backLabel="All Complaints"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTrackingLink}
              leftIcon={
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              }
            >
              Share Tracker
            </Button>

            {/* Quick link for hackathon judges */}
            <Link
              to={`/authority/complaints/${complaint.id}`}
            >
              <Button
                variant="subtle"
                size="sm"
                leftIcon={
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                }
              >
                View as Authority Desk
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* =====================================================
            LEFT COLUMN
        ====================================================== */}

        <div className="lg:col-span-7 space-y-6">

          {/* Main Title & Description Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60">
                {complaint.issueType}
              </span>

              <SeverityBadge
                severity={complaint.severity}
                safetyRisk={complaint.safetyRisk}
                size="md"
                showRiskLabel
              />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              {complaint.title}
            </h2>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Official Incident Description
              </h4>

              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {complaint.description}
              </p>
            </div>

            {complaint.citizenNotes && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Citizen Context Submitted:
                </span>

                <p className="text-slate-600 italic">
                  "{complaint.citizenNotes}"
                </p>
              </div>
            )}
          </div>

          {/* =====================================================
              MUNICIPAL RESOLUTION PROOF
          ====================================================== */}

          {resolvedImageSrc ? (
            <div className="bg-white rounded-2xl border-2 border-emerald-500/30 p-5 sm:p-6 shadow-sm space-y-5">

              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">

                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>
                        Official Resolution Proof
                      </span>

                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Ground Verified
                      </span>
                    </h3>

                    <p className="text-xs text-slate-500">
                      Visual comparison: Citizen report vs. Municipal field remediation
                    </p>
                  </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">

                  <button
                    type="button"
                    onClick={() =>
                      setProofViewMode("split")
                    }
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      proofViewMode === "split"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Before &amp; After
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setProofViewMode("after")
                    }
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      proofViewMode === "after"
                        ? "bg-white text-emerald-800 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Resolution Proof
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setProofViewMode("before")
                    }
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      proofViewMode === "before"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Original Report
                  </button>
                </div>
              </div>

              {/* Visual Comparison */}
              {proofViewMode === "split" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* BEFORE */}
                  <div className="space-y-2">

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        BEFORE: Reported Incident
                      </span>

                      <span className="text-2xs text-slate-400 font-mono">
                        {formatDate(
                          complaint.createdAt
                        )}
                      </span>
                    </div>

                    <div
                      onClick={() =>
                        setPreviewModalImage({
                          url: complaint.image,
                          title:
                            "Original Citizen Evidence",
                        })
                      }
                      className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video relative group cursor-pointer"
                    >
                      <img
                        src={complaint.image}
                        alt="Original Citizen Evidence"
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      />

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                        <Eye className="w-4 h-4" />
                        <span>
                          Enlarge Original
                        </span>
                      </div>

                      <span className="absolute bottom-2 left-2 text-2xs font-semibold px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                        Incident Evidence
                      </span>
                    </div>
                  </div>

                  {/* AFTER */}
                  <div className="space-y-2">

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        AFTER: Remediation Proof
                      </span>

                      <span className="text-2xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Official Authority Photo
                      </span>
                    </div>

                    <div
                      onClick={() =>
                        setPreviewModalImage({
                          url: resolvedImageSrc,
                          title:
                            "Official Authority Resolution Proof",
                        })
                      }
                      className="rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-slate-950 aspect-video relative group cursor-pointer shadow-xs"
                    >
                      <img
                        src={resolvedImageSrc}
                        alt="Authority Resolution Proof"
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      />

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                        <Eye className="w-4 h-4" />
                        <span>
                          Enlarge Proof Photo
                        </span>
                      </div>

                      <span className="absolute bottom-2 left-2 text-2xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>
                          Ground Rectified
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* AFTER ONLY */}
              {proofViewMode === "after" && (
                <div className="space-y-2">

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Official Municipal Ground Remediation Photograph
                    </span>

                    <span className="text-2xs font-mono text-slate-500">
                      Resolved:{" "}
                      {formatDate(
                        complaint.updatedAt
                      )}
                    </span>
                  </div>

                  <div
                    onClick={() =>
                      setPreviewModalImage({
                        url: resolvedImageSrc,
                        title:
                          "Official Authority Resolution Proof",
                      })
                    }
                    className="rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-slate-950 aspect-video relative group cursor-pointer"
                  >
                    <img
                      src={resolvedImageSrc}
                      alt="Authority Resolution Proof"
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                      <Eye className="w-4 h-4" />
                      <span>
                        Click to View Full Resolution
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                      <span className="font-semibold bg-emerald-600/90 backdrop-blur-xs px-2.5 py-1 rounded-md">
                        Inspected by{" "}
                        {complaint.authority}
                      </span>

                      <span className="font-mono text-2xs bg-black/60 px-2 py-1 rounded-md">
                        Ticket ID: {complaint.id}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* BEFORE ONLY */}
              {proofViewMode === "before" && (
                <div className="space-y-2">

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">
                      Original Citizen Evidence Submitted
                    </span>

                    <span className="text-2xs font-mono text-slate-500">
                      Reported:{" "}
                      {formatDate(
                        complaint.createdAt
                      )}
                    </span>
                  </div>

                  <div
                    onClick={() =>
                      setPreviewModalImage({
                        url: complaint.image,
                        title:
                          "Original Citizen Evidence",
                      })
                    }
                    className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video relative group cursor-pointer"
                  >
                    <img
                      src={complaint.image}
                      alt={complaint.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                      <Eye className="w-4 h-4" />
                      <span>
                        Click to View Full Size
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Officer Sign-off */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/70 space-y-2">

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>
                      Municipal Field Sign-Off Statement:
                    </span>
                  </span>

                  <span className="text-2xs font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    Audit Certified &bull;{" "}
                    {complaint.authority}
                  </span>
                </div>

                <p className="text-xs text-emerald-950 leading-relaxed italic">
                  "{latestOfficerNote}"
                </p>

                <div className="pt-2 border-t border-emerald-200/50 flex items-center justify-between text-2xs text-emerald-800 flex-wrap gap-2">
                  <span>
                    Remediation verified by on-site municipal engineering team.
                  </span>

                  <span className="font-mono">
                    Closure timestamp:{" "}
                    {formatDate(
                      complaint.updatedAt
                    )}
                  </span>
                </div>
              </div>

              {/* Citizen Ground Verification */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Citizen Community Confirmation
                  </h4>

                  <p className="text-2xs text-slate-500">
                    Does the ground photographic proof match your expectations?
                  </p>
                </div>

                {citizenFeedback ? (
                  <div
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      citizenFeedback === "CONFIRMED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                    }`}
                  >
                    {citizenFeedback ===
                    "CONFIRMED" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />

                        <span>
                          You confirmed this resolution on{" "}
                          {formatDate(new Date())}
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-amber-700" />

                        <span>
                          Re-inspection dispute logged for Department audit
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleCitizenFeedback(
                          "DISPUTE"
                        )
                      }
                      className="text-xs border-slate-200 hover:border-amber-400 hover:text-amber-800"
                    >
                      Issue Still Exists
                    </Button>

                    <Button
                      variant="success"
                      size="sm"
                      onClick={() =>
                        handleCitizenFeedback(
                          "CONFIRMED"
                        )
                      }
                      leftIcon={
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      }
                      className="text-xs shadow-xs"
                    >
                      Confirm Resolved
                    </Button>

                  </div>
                )}
              </div>
            </div>
          ) : (

            /* =====================================================
               STANDARD EVIDENCE PHOTO CARD
            ====================================================== */

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">

              <div className="flex items-center justify-between">

                <h3 className="text-sm font-semibold text-slate-900">
                  Photographic Evidence
                </h3>

                {complaint.aiMetadata?.confidenceScore && (
                  <span className="inline-flex items-center gap-1 text-2xs font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">

                    <Sparkles className="w-3 h-3 text-emerald-600" />

                    Vision AI Verified (
                    {Math.round(
                      complaint.aiMetadata.confidenceScore *
                        100
                    )}
                    %)
                  </span>
                )}
              </div>

              <div
                onClick={() =>
                  setPreviewModalImage({
                    url: complaint.image,
                    title:
                      "Original Citizen Evidence",
                  })
                }
                className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video relative group cursor-pointer"
              >

                <img
                  src={complaint.image}
                  alt={complaint.title}
                  className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-300"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">

                  <span className="font-semibold">
                    {complaint.issueType}
                  </span>

                  <span className="text-2xs text-slate-300 font-mono">
                    {formatDate(
                      complaint.createdAt
                    )}
                  </span>
                </div>
              </div>

              {/* Proof status */}
              {complaint.status ===
              "RESOLVED" ? (

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">

                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />

                  <div>

                    <span className="font-bold block">
                      Awaiting Authority Photo Proof Upload
                    </span>

                    <span className="text-2xs text-amber-800">
                      This ticket was marked as Resolved by{" "}
                      {complaint.authority}, but the field supervisor has not yet uploaded the ground completion photograph.
                    </span>

                  </div>
                </div>

              ) : (

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/70 flex items-start gap-2.5 text-xs text-blue-900">

                  <Camera className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />

                  <div>

                    <span className="font-bold block">
                      Authority Resolution Photo Proof Required
                    </span>

                    <span className="text-2xs text-blue-800/80">
                      Once municipal field crews complete ground remediation, an official verified Before &amp; After resolution photograph will be published here by{" "}
                      {complaint.authority}.
                    </span>

                  </div>
                </div>
              )}

              {complaint.aiMetadata?.tags && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">

                  {complaint.aiMetadata.tags.map(
                    (tag, i) => (
                      <span
                        key={i}
                        className="text-2xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200"
                      >
                        #{tag}
                      </span>
                    )
                  )}

                </div>
              )}
            </div>
          )}

          {/* Incident Location */}
          <LocationCard
            location={complaint.location}
            readOnly={true}
          />
        </div>

        {/* =====================================================
            RIGHT COLUMN
        ====================================================== */}

        <div className="lg:col-span-5 space-y-6">

          {/* Status & Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-5">

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">

              <div className="flex items-center gap-2">

                <Clock className="w-4 h-4 text-blue-600" />

                <h3 className="text-sm font-semibold text-slate-900">
                  Resolution Progress Timeline
                </h3>

              </div>

              <StatusBadge
                status={complaint.status}
                size="sm"
              />
            </div>

            {/* Vertical Stepper */}
            <ComplaintTimeline
              timeline={
                complaint.timeline || []
              }
              currentStatus={
                complaint.status
              }
            />
          </div>

          {/* =====================================================
              ASSIGNED AUTHORITY & SLA
          ====================================================== */}

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3.5">

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">

              <Building2 className="w-4 h-4 text-blue-600" />

              <span>
                Assigned Authority
              </span>

            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/70">

              <h4 className="text-base font-bold text-slate-900">
                {complaint.authority}
              </h4>

              <p className="text-xs text-slate-600 mt-1">
                Municipal Operations Division &bull; Sector Ward 62
              </p>
            </div>

            <div className="pt-2 text-xs text-slate-500 space-y-2">

              {/* Ticket ID */}
              <div className="flex items-center justify-between gap-3">

                <span>
                  Public Ticket ID:
                </span>

                <span className="font-mono font-semibold text-slate-900">
                  {complaint.id}
                </span>

              </div>

              {/* Last Updated */}
              <div className="flex items-center justify-between gap-3">

                <span>
                  Last Updated:
                </span>

                <span className="font-medium text-slate-900">
                  {formatDate(
                    complaint.updatedAt
                  )}
                </span>

              </div>

              {/* Dynamic SLA Card */}
              <div
                className={`rounded-xl border p-3.5 mt-3 ${slaDisplay.container}`}
              >

                <div className="flex items-start justify-between gap-3">

                  <div className="flex items-start gap-2.5">

                    <Clock
                      className={`w-4 h-4 mt-0.5 shrink-0 ${slaDisplay.icon}`}
                    />

                    <div>

                      <div
                        className={`text-xs font-bold ${slaDisplay.text}`}
                      >
                        SLA:{" "}
                        {slaDisplay.label}
                      </div>

                      <div className="text-2xs text-slate-600 mt-0.5">
                        {slaDisplay.description}
                      </div>

                    </div>
                  </div>

                  {slaStatus ===
                    "BREACHED" && (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}

                  {slaStatus ===
                    "RESOLVED" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}

                </div>
              </div>

              {/* SLA Deadline */}
              {slaDeadline && (
                <div className="flex items-center justify-between gap-3">

                  <span>
                    Resolution Deadline:
                  </span>

                  <span className="font-semibold text-slate-900 text-right">
                    {formatDate(
                      slaDeadline
                    )}
                  </span>

                </div>
              )}

              {/* Escalation Count */}
              <div className="flex items-center justify-between gap-3">

                <span>
                  Escalations Sent:
                </span>

                <span
                  className={`font-semibold ${
                    escalationCount > 0
                      ? "text-red-700"
                      : "text-slate-900"
                  }`}
                >
                  {escalationCount}
                </span>

              </div>

              {/* Last Escalation */}
              {lastEscalationAt && (
                <div className="flex items-center justify-between gap-3">

                  <span>
                    Last Escalation:
                  </span>

                  <span className="font-medium text-slate-900 text-right">
                    {formatDate(
                      lastEscalationAt
                    )}
                  </span>

                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          LIGHTBOX / HIGH-RES IMAGE PREVIEW
      ====================================================== */}

      {previewModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() =>
            setPreviewModalImage(null)
          }
        >

          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="p-3 sm:p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-white">

              <span className="text-sm font-semibold truncate pr-4">
                {previewModalImage.title}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPreviewModalImage(null)
                }
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-2 sm:p-4 bg-black flex items-center justify-center max-h-[75vh] overflow-auto">

              <img
                src={previewModalImage.url}
                alt={
                  previewModalImage.title
                }
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />

            </div>
          </div>
        </div>
      )}
    </div>
  );
}