import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  MapPin,
  CheckCircle2,
  Cpu,
  Clock,
  Scan,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { SeverityBadge } from "../../components/SeverityBadge";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import * as api from "../../services/api";

export function AnalyzePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve input state from location or sessionStorage draft fallback
  const inputData = location.state || (() => {
    try {
      const draft = sessionStorage.getItem("civicai_report_draft");
      return draft ? JSON.parse(draft) : null;
    } catch {
      return null;
    }
  })();

  const [analyzing, setAnalyzing] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);

  // Actual source-image dimensions
  const [imageDimensions, setImageDimensions] = useState({
    width: 1,
    height: 1,
  });

  // Geometry of the actual image rendered inside the container.
  // Needed because object-contain introduces letterboxing.
  const imageContainerRef = useRef(null);

  const [imageGeometry, setImageGeometry] = useState({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  });

  const ANALYSIS_MILESTONES = [
    "Running computer vision feature extraction on incident photo...",
    "Classifying hazard geometry, depth, and road obstruction...",
    "Evaluating public safety hazard level & pedestrian risk...",
    "Identifying municipal division & jurisdictional department...",
    "Synthesizing structured civic complaint draft...",
  ];

  /*
   * Calculate where the real image is rendered inside the
   * fixed-size container when using object-contain.
   *
   * YOLO coordinates are relative to the original image.
   * We therefore need:
   *
   * original image
   *      ↓
   * object-contain scaling
   *      ↓
   * rendered image rectangle
   *      ↓
   * YOLO bbox mapped into that rectangle
   */
  useEffect(() => {
    const updateImageGeometry = () => {
      const container = imageContainerRef.current;

      if (
        !container ||
        !imageDimensions.width ||
        !imageDimensions.height
      ) {
        return;
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      if (!containerWidth || !containerHeight) {
        return;
      }

      const scale = Math.min(
        containerWidth / imageDimensions.width,
        containerHeight / imageDimensions.height
      );

      const renderedWidth = imageDimensions.width * scale;
      const renderedHeight = imageDimensions.height * scale;

      const offsetX = (containerWidth - renderedWidth) / 2;
      const offsetY = (containerHeight - renderedHeight) / 2;

      setImageGeometry({
        left: (offsetX / containerWidth) * 100,
        top: (offsetY / containerHeight) * 100,
        width: (renderedWidth / containerWidth) * 100,
        height: (renderedHeight / containerHeight) * 100,
      });
    };

    updateImageGeometry();

    const container = imageContainerRef.current;

    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateImageGeometry);

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageDimensions]);

  useEffect(() => {
    if (!inputData?.image) {
      navigate("/report", { replace: true });
      return;
    }

    let isMounted = true;

    setAnalyzing(true);
    setError(null);
    setAnalysisStep(0);

    // Step milestone animation
    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) =>
        prev < ANALYSIS_MILESTONES.length - 1
          ? prev + 1
          : prev
      );
    }, 280);

    // Call analyzeIssue API
    api
      .analyzeIssue({
        image: inputData.image,
        file: inputData.imageFile,
        description: inputData.description,
        location: inputData.location,
        sampleId: inputData.selectedSampleId,
      })
      .then((res) => {
        if (!isMounted) return;

        if (res.success) {
          // Keep loading visible briefly for high-tech aesthetic
          setTimeout(() => {
            if (isMounted) {
              setAiResult(res.data);
              setAnalyzing(false);
              clearInterval(stepInterval);
            }
          }, 1400);
        } else {
          setError(res.error || "Failed to analyze image.");
          setAnalyzing(false);
          clearInterval(stepInterval);
        }
      })
      .catch((err) => {
        if (!isMounted) return;

        setError(
          err.message || "Network error during analysis."
        );

        setAnalyzing(false);
        clearInterval(stepInterval);
      });

    return () => {
      isMounted = false;
      clearInterval(stepInterval);
    };
  }, [inputData, navigate]);

  const handleProceedToReview = () => {
    const reviewPayload = {
      ...inputData,
      aiAnalysis: aiResult,
    };

    sessionStorage.setItem(
      "civicai_report_draft",
      JSON.stringify(reviewPayload)
    );

    navigate("/review", {
      state: reviewPayload,
    });
  };

  if (!inputData?.image) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="CivicAI Vision Analysis"
        description="Our AI model processes the visual data, detects risk severity, and maps the incident to the appropriate civic authority."
        backTo="/report"
        backLabel="Edit Report"
      />

      {analyzing ? (
        <div className="space-y-6">
          {/* Scanning Container */}
          <div className="relative rounded-3xl overflow-hidden border border-blue-200 bg-slate-900 shadow-xl max-w-2xl mx-auto">
            <img
              src={inputData.image}
              alt="Analyzing evidence"
              className="w-full h-80 object-cover object-center opacity-70 filter contrast-125"
            />

            {/* Scan line */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#3b82f6] animate-scanline pointer-events-none" />

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none" />

            {/* Scanning HUD */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-2xs font-mono text-blue-300">
              <span className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded backdrop-blur-xs">
                <Scan className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                OBJECT_DETECTION_ACTIVE
              </span>

              <span className="bg-black/60 px-2 py-1 rounded backdrop-blur-xs">
                GPS:{" "}
                {inputData.location?.lat?.toFixed(4) ||
                  "28.6280"}{" "}
                N,{" "}
                {inputData.location?.lng?.toFixed(4) ||
                  "77.3649"}{" "}
                E
              </span>
            </div>

            {/* Center Processing */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/90 border border-blue-400/40 backdrop-blur-md flex items-center justify-center text-white shadow-xl shadow-blue-500/30 mb-4 animate-pulse">
                <Cpu className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold tracking-tight">
                Evaluating Incident Visuals
              </h3>

              <p className="text-xs text-blue-200 mt-2 font-mono max-w-md bg-slate-950/70 py-1.5 px-3 rounded-lg border border-blue-500/30 backdrop-blur-sm">
                {ANALYSIS_MILESTONES[analysisStep]}
              </p>
            </div>

            {/* Bottom Progress */}
            <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-800">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{
                  width: `${
                    ((analysisStep + 1) /
                      ANALYSIS_MILESTONES.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>

          <LoadingState
            variant="default"
            message="Categorizing civic department and drafting complaint..."
            subtext="Zero manual classification needed. Routing based on municipal charter."
          />
        </div>
      ) : error ? (
        <ErrorState
          title="Analysis Failed"
          message={error}
          onRetry={() => window.location.reload()}
        />
      ) : aiResult ? (
        <div className="space-y-6">
          {/* Main Inspection Results Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
            {/* Top Verification Ribbon */}
            <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />

                <span>
                  {aiResult.classificationSource === "cv"
                    ? `AI Vision Analysis Complete • CV Detection (${Math.round(
                        (aiResult.confidenceScore || 0) * 100
                      )}%)`
                    : "AI Vision Analysis Complete • Multimodal AI Fallback"}
                </span>
              </div>

              <span className="text-2xs font-mono text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded font-medium">
                {aiResult.classificationSource === "cv"
                  ? "CV Classified"
                  : "AI Classified"}
              </span>
            </div>

            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* Left: Image */}
                <div className="md:col-span-5 space-y-3">
                  <div
                    ref={imageContainerRef}
                    className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xs group bg-slate-950"
                  >
                    <img
                      src={inputData.image}
                      alt="Analyzed incident"
                      className="w-full h-64 object-contain object-center"
                      onLoad={(e) => {
                        setImageDimensions({
                          width: e.currentTarget.naturalWidth,
                          height: e.currentTarget.naturalHeight,
                        });
                      }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                    {/* ================================================= */}
                    {/* REAL YOLO DETECTION BOXES                        */}
                    {/* ================================================= */}
                    {aiResult.classificationSource === "cv" &&
                      aiResult.cvDetection?.detections?.map(
                        (detection, index) => {
                          if (!detection.bbox) {
                            return null;
                          }

                          const [
                            x1,
                            y1,
                            x2,
                            y2,
                          ] = detection.bbox;

                          /*
                           * Convert YOLO coordinates from the
                           * original image coordinate system
                           * into percentages of the original image.
                           */
                          const relativeLeft =
                            (x1 / imageDimensions.width) * 100;

                          const relativeTop =
                            (y1 / imageDimensions.height) * 100;

                          const relativeWidth =
                            ((x2 - x1) /
                              imageDimensions.width) *
                            100;

                          const relativeHeight =
                            ((y2 - y1) /
                              imageDimensions.height) *
                            100;

                          /*
                           * Map the original-image percentages
                           * into the actual object-contain
                           * rendered image rectangle.
                           */
                          const left =
                            imageGeometry.left +
                            (relativeLeft *
                              imageGeometry.width) /
                              100;

                          const top =
                            imageGeometry.top +
                            (relativeTop *
                              imageGeometry.height) /
                              100;

                          const width =
                            (relativeWidth *
                              imageGeometry.width) /
                            100;

                          const height =
                            (relativeHeight *
                              imageGeometry.height) /
                            100;

                          return (
                            <div
                              key={index}
                              className="absolute border-2 border-blue-400 pointer-events-none"
                              style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                              }}
                            >
                              <span className="absolute -top-6 left-0 text-3xs font-mono font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                                {detection.category} [
                                {Math.round(
                                  detection.confidence * 100
                                )}
                                %]
                              </span>
                            </div>
                          );
                        }
                      )}

                    {/* Bottom Image Label */}
                    <div className="absolute bottom-3 left-3 right-3 text-white text-xs pointer-events-none">
                      <p className="font-semibold">
                        {aiResult.issueType}
                      </p>

                      <p className="text-2xs text-slate-300 truncate">
                        {inputData.location?.address ||
                          "Location captured"}
                      </p>
                    </div>
                  </div>

                  {/* AI Tags */}
                  {aiResult.tags && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {aiResult.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-2xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/80"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Diagnostics & Routing */}
                <div className="md:col-span-7 space-y-6">
                  {/* Issue Type & Severity */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <SeverityBadge
                        severity={aiResult.severity}
                        safetyRisk={aiResult.safetyRisk}
                        size="md"
                        showRiskLabel
                      />

                      <span className="text-xs text-slate-400 font-medium">
                        &bull;
                      </span>

                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {aiResult.category}
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {aiResult.issueType}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                      {aiResult.description}
                    </p>
                  </div>

                  {/* Responsible Authority */}
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                      <Building2 className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-2xs font-bold uppercase tracking-wider text-blue-600">
                        Responsible Municipal Authority
                      </p>

                      <h4 className="text-base font-bold text-slate-900 mt-0.5">
                        {aiResult.authority}
                      </h4>

                      <p className="text-xs text-slate-600 mt-1">
                        Jurisdiction verified for road repair,
                        structural remediation, and civic safety
                        compliance.
                      </p>
                    </div>
                  </div>

                  {/* Location & Routing Summary */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-2xs text-slate-600 font-semibold block uppercase">
                        Geo-Coordinate Lock
                      </span>

                      <div className="flex items-center gap-1.5 mt-1 font-mono text-slate-800 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />

                        <span className="truncate">
                          {inputData.location?.lat?.toFixed(4) ||
                            "—"}
                          ,{" "}
                          {inputData.location?.lng?.toFixed(4) ||
                            "—"}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-2xs text-slate-600 font-semibold block uppercase">
                        Target Response SLA
                      </span>

                      <div className="flex items-center gap-1.5 mt-1 text-slate-800 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />

                        <span>24 - 48 Hours</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="px-6 sm:px-8 py-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Link to="/report">
                <Button
                  variant="ghost"
                  size="md"
                  leftIcon={
                    <RotateCcw className="w-4 h-4" />
                  }
                >
                  Re-upload Photo
                </Button>
              </Link>

              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleProceedToReview}
                rightIcon={
                  <ArrowRight className="w-4 h-4" />
                }
                className="w-full sm:w-auto shadow-md shadow-blue-600/20 px-6 font-semibold"
              >
                Review &amp; Submit Complaint
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}