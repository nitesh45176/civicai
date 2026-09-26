/**
 * CivicAI API Client Layer
 * 
 * In Demo Mode:
 * Routes all calls to mockApi.js using simulated async latency and localStorage.
 * 
 * In Production / FastAPI Mode:
 * Directs requests to VITE_API_BASE_URL (http://localhost:8000/api).
 */

import * as mockApi from "./mockApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

// Check if running on HTTPS host (e.g. Vercel) while configured to HTTP localhost (which is blocked by browser mixed content rules)
const isBrowser = typeof window !== "undefined";
const isHttpsOrigin = isBrowser && window.location.protocol === "https:";
const isLocalhostHttpBackend = API_BASE_URL.startsWith("http://localhost") || API_BASE_URL.startsWith("http://127.0.0.1");
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" || (isHttpsOrigin && isLocalhostHttpBackend);

export function formatImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    return `${BACKEND_ORIGIN}${url}`;
  }
  return url;
}

/**
 * Normalizes complaint objects from FastAPI backend or mockApi to match frontend component properties
 */
export function normalizeComplaint(item) {
  if (!item) return item;
  const id = item.complaint_id || item.id || "CIV-2026-00000";
  const rawStatus = (item.status || "SUBMITTED").toUpperCase().trim();
  const resImg = formatImageUrl(item.resolution_image_url || item.resolutionImage || item.resolution_image || "");
  const rawTimeline = Array.isArray(item.status_history)
    ? item.status_history
    : (Array.isArray(item.timeline) ? item.timeline : []);

  return {
    ...item,
    id,
    complaint_id: id,
    status: rawStatus,
    issueType: item.issue_type || item.issueType || "Civic Hazard",
    title: item.complaint_title || item.title || "Civic Complaint",
    description: item.complaint_description || item.description || "",
    category: item.category || "General",
    severity: item.severity || "Medium",
    safetyRisk: Boolean(item.safety_risk ?? item.safetyRisk ?? false),
    image: formatImageUrl(item.image_url || item.image || ""),
    resolutionImage: resImg,
    resolution_image_url: resImg,
    authority: typeof item.authority === "object" ? item.authority?.name : (item.authority || "Municipal Authority"),
    authority_id: typeof item.authority === "object" ? item.authority?.id : (item.authority_id || 1),
    location: {
      address: item.location_text || item.location?.address || "Noida, Uttar Pradesh",
      lat: item.latitude ?? item.location?.lat ?? 28.6280,
      lng: item.longitude ?? item.location?.lng ?? 77.3649,
    },
    createdAt: item.created_at || item.createdAt || new Date().toISOString(),
    updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
    timeline: rawTimeline.map((h) => {
      const stage = (h.stage || h.status || "SUBMITTED").toUpperCase().trim();
      return {
        stage,
        status: stage,
        title: h.title || h.note || `Stage: ${stage}`,
        timestamp: h.timestamp || h.changed_at || new Date().toISOString(),
        changed_at: h.changed_at || h.timestamp || new Date().toISOString(),
        description: h.description || h.note || `Stage updated to ${stage}`,
        note: h.note || h.description || `Stage updated to ${stage}`,
        actor: h.actor || "Municipal Authority Desk"
      };
    }),
    aiMetadata: item.aiMetadata || {
      confidenceScore: 0.96,
      tags: [item.issue_type || "Civic", item.category || "Municipal", "Verified"]
    }
  };
}

/**
 * 1. POST /api/analyze
 * Analyzes photo + location metadata with Vision AI
 */
export async function analyzeIssue(data) {
  if (IS_DEMO_MODE) {
    return mockApi.analyzeIssue(data);
  }

  try {
    const formData = new FormData();
    
    // Resolve file from File, Blob, base64 data URL, or remote URL
    let fileToUpload = data.file;
    if (!fileToUpload && data.image) {
      try {
        const response = await fetch(data.image);
        const blob = await response.blob();
        fileToUpload = new File([blob], "evidence.jpg", { type: blob.type || "image/jpeg" });
      } catch (fetchErr) {
        console.warn("Could not convert image URL to Blob, falling back to mock:", fetchErr);
        return mockApi.analyzeIssue(data);
      }
    }

    if (fileToUpload) {
      formData.append("image", fileToUpload);
    }
    if (data.description) formData.append("optional_text", data.description);
    if (data.location?.lat != null) formData.append("latitude", data.location.lat.toString());
    if (data.location?.lng != null) formData.append("longitude", data.location.lng.toString());

    const res = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    
    // Normalize analysis result for React UI
    const normalizedAI = {
      issueType: json.issue_type,
      category: json.category,
      severity: json.severity.charAt(0).toUpperCase() + json.severity.slice(1),
      safetyRisk: json.safety_risk,
      description: json.description,
      suggestedTitle: json.complaint_title,
      suggestedDescription: json.complaint_description,
      authority: json.authority?.name || "Public Works Department",
      authority_id: json.authority?.id || 1,
      image: formatImageUrl(json.image_url),
      confidenceScore: json.cv_detection?.confidence || 0,
      cvDetection: json.cv_detection || null,
      classificationSource: json.classification_source || "groq",
      tags: [json.issue_type, json.category, "AI-Verified"],
      location: data.location || {
        address: "Sector 62, Noida, UP",
        lat: json.location?.latitude || 28.6280,
        lng: json.location?.longitude || 77.3649,
      }
    };

    return { success: true, data: normalizedAI };
  } catch (err) {
    console.warn("Live API /api/analyze failed, falling back to mockApi:", err);
    return mockApi.analyzeIssue(data);
  }
}

/**
 * 2. POST /api/complaints
 * Creates and registers a new official civic complaint
 */
export async function createComplaint(complaintData) {
  if (IS_DEMO_MODE) {
    const mockRes = await mockApi.createComplaint(complaintData);
    if (mockRes.success && mockRes.data) {
      const normalized = normalizeComplaint(mockRes.data);
      window.dispatchEvent(new CustomEvent("civicai_complaints_updated", { detail: normalized }));
      return { success: true, data: normalized };
    }
    return mockRes;
  }

  try {
    const payload = {
      issue_type: (complaintData.issueType || complaintData.issue_type || "Civic Hazard").toLowerCase(),
      category: (complaintData.category || "general_infrastructure").toLowerCase(),
      severity: (complaintData.severity || "medium").toLowerCase(),
      safety_risk: Boolean(complaintData.safetyRisk ?? complaintData.safety_risk),
      complaint_title: complaintData.title || complaintData.complaint_title || "Civic Hazard Report",
      complaint_description: complaintData.description || complaintData.complaint_description || "Issue observed on municipal property.",
      image_url: complaintData.image || complaintData.image_url || "",
      latitude: complaintData.location?.lat ?? complaintData.latitude ?? 28.6280,
      longitude: complaintData.location?.lng ?? complaintData.longitude ?? 77.3649,
      location_text: complaintData.location?.address || complaintData.location_text || "Sector 62, Noida",
      authority_id:
        complaintData.authority_id ||
        (typeof complaintData.authority === "object" ? complaintData.authority?.id : null) ||
        ({
          sanitation: 2,
          electrical: 3,
          water_supply: 4,
          urban_safety: 5,
          stormwater_drainage: 6,
          road_infrastructure: 1,
        }[(complaintData.category || "").toLowerCase().replace(/[_\s-]+/g, "_")] || 1),
      ai_description: complaintData.ai_description || complaintData.description,
    };

    const res = await fetch(`${API_BASE_URL}/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const normalized = normalizeComplaint(json);

    // Notify listeners so UI updates immediately
    window.dispatchEvent(new CustomEvent("civicai_complaints_updated", { detail: normalized }));

    return { success: true, data: normalized };
  } catch (err) {
    console.warn("Live API /api/complaints failed, falling back to mockApi:", err);
    const mockRes = await mockApi.createComplaint(complaintData);
    if (mockRes.success && mockRes.data) {
      const normalized = normalizeComplaint(mockRes.data);
      window.dispatchEvent(new CustomEvent("civicai_complaints_updated", { detail: normalized }));
      return { success: true, data: normalized };
    }
    return mockRes;
  }
}

/**
 * 3. GET /api/complaints
 * Fetches list of complaints with optional status/severity filters
 */
export async function getComplaints(filters = {}) {
  if (IS_DEMO_MODE) {
    const mockRes = await mockApi.getComplaints(filters);
    if (mockRes.success && Array.isArray(mockRes.data)) {
      return {
        ...mockRes,
        data: mockRes.data.map(normalizeComplaint)
      };
    }
    return mockRes;
  }

  try {
    const queryParams = new URLSearchParams();
    if (filters.status && filters.status !== "ALL") queryParams.append("status", filters.status);
    if (filters.severity && filters.severity !== "ALL") queryParams.append("severity", filters.severity);
    if (filters.category && filters.category !== "ALL") queryParams.append("category", filters.category);
    if (filters.search) queryParams.append("search", filters.search);
    queryParams.append("limit", "100");

    const res = await fetch(`${API_BASE_URL}/complaints?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    
    const json = await res.json();
    const rawItems = json.items || (Array.isArray(json) ? json : []);
    const items = rawItems.map(normalizeComplaint);
    const count = json.total ?? items.length;

    return { success: true, count, data: items };
  } catch (err) {
    console.warn("Live API /api/complaints failed, falling back to mockApi:", err);
    const mockRes = await mockApi.getComplaints(filters);
    if (mockRes.success && Array.isArray(mockRes.data)) {
      return {
        ...mockRes,
        data: mockRes.data.map(normalizeComplaint)
      };
    }
    return mockRes;
  }
}

/**
 * 4. GET /api/complaints/{id}
 * Retrieves specific complaint with full timeline
 */
export async function getComplaintById(id) {
  if (IS_DEMO_MODE) {
    const mockRes = await mockApi.getComplaintById(id);
    if (mockRes.success && mockRes.data) {
      return { ...mockRes, data: normalizeComplaint(mockRes.data) };
    }
    return mockRes;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/complaints/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    
    const json = await res.json();
    return { success: true, data: normalizeComplaint(json) };
  } catch (err) {
    console.warn("Live API /api/complaints/{id} failed, falling back to mockApi:", err);
    const mockRes = await mockApi.getComplaintById(id);
    if (mockRes.success && mockRes.data) {
      return { ...mockRes, data: normalizeComplaint(mockRes.data) };
    }
    return mockRes;
  }
}

/**
 * 5. PATCH /api/complaints/{id}/status
 * Updates status and appends department audit entry
 */
export async function updateComplaintStatus(id, status, note = "", resolutionImage = "") {
  const applyNotificationSync = (normalized) => {
    window.dispatchEvent(new CustomEvent("civicai_complaints_updated", { detail: normalized }));
    window.dispatchEvent(new CustomEvent("civicai_complaint_updated", { detail: normalized }));

    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel("civicai_sync");
        channel.postMessage({ type: "COMPLAINT_UPDATED", detail: normalized });
        channel.close();
      } catch (_) {}
    }
    try {
      localStorage.setItem("civicai_last_sync", Date.now().toString());
    } catch (_) {}
  };

  if (IS_DEMO_MODE) {
    const mockRes = await mockApi.updateComplaintStatus(id, status, note, resolutionImage);
    if (mockRes.success && mockRes.data) {
      const normalized = normalizeComplaint(mockRes.data);
      applyNotificationSync(normalized);
      return { success: true, data: normalized };
    }
    return mockRes;
  }

  try {
    const payload = { status, note };
    if (resolutionImage) {
      payload.resolution_image = resolutionImage;
    }

    const res = await fetch(`${API_BASE_URL}/complaints/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    
    const json = await res.json();
    const normalized = normalizeComplaint(json);

    applyNotificationSync(normalized);
    return { success: true, data: normalized };
  } catch (err) {
    console.warn("Live API update failed, falling back to mockApi:", err);
    const mockRes = await mockApi.updateComplaintStatus(id, status, note, resolutionImage);
    if (mockRes.success && mockRes.data) {
      const normalized = normalizeComplaint(mockRes.data);
      applyNotificationSync(normalized);
      return { success: true, data: normalized };
    }
    return mockRes;
  }
}

/**
 * 6. GET /api/location/reverse?latitude={lat}&longitude={lng}
 * Reverse geocodes coordinates to human-readable address
 */
export async function reverseGeocode(latitude, longitude) {
  if (latitude == null || longitude == null || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
    return { success: false, error: "Latitude and longitude required" };
  }

  if (IS_DEMO_MODE) {
    return mockApi.reverseGeocode(latitude, longitude);
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/location/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const json = await res.json();
    return { success: true, data: json };
  } catch (err) {
    console.warn("Live reverseGeocode failed, trying mockApi fallback:", err);
    return mockApi.reverseGeocode(latitude, longitude);
  }
}

export { resetMockDatabase } from "./mockApi";

