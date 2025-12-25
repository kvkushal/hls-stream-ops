"""
Health Service - Simple, Explainable Health State Derivation

Design philosophy:
- No percentages, no scores
- Just GREEN / YELLOW / RED with human-readable reasons
- Easy to explain in interview: "Why is it red? Because X, Y, Z."

Thresholds are intentionally simple and tunable.
"""

import logging
from typing import Tuple, List, Optional
from app.models import HealthState, RootCause, RootCauseConfidence

logger = logging.getLogger(__name__)


# =============================================================================
# THRESHOLDS (Tunable constants for interview discussion)
# =============================================================================

class HealthThresholds:
    """
    Simple, explainable thresholds.
    
    Interview talking point: "These thresholds are configurable.
    In production, you'd tune them based on SLAs and operator feedback."
    """
    # RED thresholds (critical - needs immediate attention)
    RED_ERROR_COUNT = 3        # 3+ errors in 2 min window
    RED_TTFB_MS = 1000         # Average TTFB > 1 second
    RED_DOWNLOAD_RATIO = 0.5   # Downloads taking 2x segment duration
    
    # YELLOW thresholds (degraded - watch closely)
    YELLOW_ERROR_COUNT = 1     # Any error is concerning
    YELLOW_TTFB_MS = 500       # Average TTFB > 500ms
    YELLOW_DOWNLOAD_RATIO = 0.8  # Downloads slower than realtime


# =============================================================================
# HEALTH COMPUTATION
# =============================================================================

class HealthService:
    """
    Derives health state from metrics.
    
    Simple, deterministic, explainable.
    """
    
    def compute_health(
        self,
        error_count_2min: int,
        avg_ttfb_ms: float,
        avg_download_ratio: float
    ) -> Tuple[HealthState, str]:
        """
        Compute health state and reason.
        
        Returns:
            Tuple of (state, human-readable reason)
            
        Example outputs:
            (RED, "4 segment errors in last 2 minutes")
            (YELLOW, "Average TTFB 650ms exceeds 500ms threshold")
            (GREEN, "Stream healthy")
        """
        reasons = []
        state = HealthState.GREEN
        
        # Check for RED conditions (any one triggers RED)
        if error_count_2min >= HealthThresholds.RED_ERROR_COUNT:
            state = HealthState.RED
            reasons.append(f"{error_count_2min} segment errors in last 2 minutes")
        
        if avg_ttfb_ms > HealthThresholds.RED_TTFB_MS:
            state = HealthState.RED
            reasons.append(f"Average TTFB {avg_ttfb_ms:.0f}ms exceeded {HealthThresholds.RED_TTFB_MS}ms threshold (last 2 min)")
        
        if avg_download_ratio < HealthThresholds.RED_DOWNLOAD_RATIO:
            state = HealthState.RED
            ratio_str = f"{avg_download_ratio:.2f}x"
            reasons.append(f"Download ratio {ratio_str} fell below {HealthThresholds.RED_DOWNLOAD_RATIO}x threshold")
        
        # If not RED, check for YELLOW conditions
        if state == HealthState.GREEN:
            if error_count_2min >= HealthThresholds.YELLOW_ERROR_COUNT:
                state = HealthState.YELLOW
                reasons.append(f"{error_count_2min} segment error(s) in last 2 minutes")
            
            if avg_ttfb_ms > HealthThresholds.YELLOW_TTFB_MS:
                state = HealthState.YELLOW
                reasons.append(f"Average TTFB {avg_ttfb_ms:.0f}ms exceeded {HealthThresholds.YELLOW_TTFB_MS}ms threshold (last 2 min)")
            
            if avg_download_ratio < HealthThresholds.YELLOW_DOWNLOAD_RATIO:
                state = HealthState.YELLOW
                ratio_str = f"{avg_download_ratio:.2f}x"
                reasons.append(f"Download ratio {ratio_str} fell below {HealthThresholds.YELLOW_DOWNLOAD_RATIO}x threshold")
        
        # Build reason string
        if reasons:
            reason = "; ".join(reasons)
        else:
            reason = "Stream healthy"
        
        return state, reason
    
    def classify_root_cause(
        self,
        error_count_2min: int,
        avg_ttfb_ms: float,
        avg_download_ratio: float,
        manifest_errors: int = 0,
        consecutive_segment_errors: int = 0
    ) -> Optional[RootCause]:
        """
        Rule-based root cause classification with evidence.
        
        NO ML. Fully explainable. Every classification has clear evidence.
        
        Classification rules (in priority order):
        1. Manifest unreachable → Origin/CDN Outage (HIGH confidence)
        2. Manifest OK + many segment 404s → Encoder/Packager Issue (MEDIUM)
        3. High TTFB + low ratio → Network Congestion (MEDIUM)
        4. Moderate issues → Intermittent Issues (LOW)
        """
        evidence: List[str] = []
        
        # Rule 1: Manifest errors → Origin/CDN Outage
        if manifest_errors > 0:
            evidence.append(f"{manifest_errors} manifest fetch failures")
            return RootCause(
                label="Origin/CDN Outage",
                confidence=RootCauseConfidence.HIGH,
                evidence=evidence
            )
        
        # Rule 2: Consecutive segment errors → Encoder/Packager Issue
        if consecutive_segment_errors >= 3:
            evidence.append(f"{consecutive_segment_errors} consecutive segment errors")
            evidence.append("Manifest accessible but segments failing")
            return RootCause(
                label="Encoder/Packager Issue",
                confidence=RootCauseConfidence.MEDIUM,
                evidence=evidence
            )
        
        # Rule 3: High TTFB + low download ratio → Network Congestion
        if avg_ttfb_ms > 800 and avg_download_ratio < 0.7:
            evidence.append(f"High TTFB ({avg_ttfb_ms:.0f}ms)")
            evidence.append(f"Low download ratio ({avg_download_ratio:.2f}x)")
            return RootCause(
                label="Network Congestion",
                confidence=RootCauseConfidence.MEDIUM,
                evidence=evidence
            )
        
        # Rule 4: Just high TTFB → CDN Edge Latency
        if avg_ttfb_ms > HealthThresholds.YELLOW_TTFB_MS:
            evidence.append(f"Average TTFB {avg_ttfb_ms:.0f}ms exceeded {HealthThresholds.YELLOW_TTFB_MS}ms threshold")
            return RootCause(
                label="CDN Edge Latency",
                confidence=RootCauseConfidence.LOW,
                evidence=evidence
            )
        
        # Rule 5: Just slow downloads → Bandwidth Constraint
        if avg_download_ratio < HealthThresholds.YELLOW_DOWNLOAD_RATIO:
            evidence.append(f"Download ratio {avg_download_ratio:.2f}x")
            return RootCause(
                label="Bandwidth Constraint",
                confidence=RootCauseConfidence.LOW,
                evidence=evidence
            )
        
        # Rule 6: Segment errors but not patterned → Intermittent Issues
        if error_count_2min > 0:
            evidence.append(f"{error_count_2min} errors in last 2 minutes")
            return RootCause(
                label="Intermittent Issues",
                confidence=RootCauseConfidence.LOW,
                evidence=evidence
            )
        
        return None  # No issues detected
    
    def should_create_incident(
        self,
        current_state: HealthState,
        previous_state: HealthState,
        yellow_duration_seconds: float = 0
    ) -> Tuple[bool, str]:
        """
        Determine if an incident should be created.
        
        Rules:
        - GREEN -> RED: Immediate incident
        - YELLOW -> RED: Immediate incident
        - YELLOW persisting > 2 minutes: Incident (prolonged degradation)
        
        Returns:
            Tuple of (should_create, trigger_reason)
        """
        YELLOW_THRESHOLD_SECONDS = 120  # 2 minutes
        
        # Direct transition to RED
        if current_state == HealthState.RED and previous_state != HealthState.RED:
            return True, f"Health degraded from {previous_state.value.upper()} to RED"
        
        # Prolonged YELLOW
        if current_state == HealthState.YELLOW and yellow_duration_seconds > YELLOW_THRESHOLD_SECONDS:
            return True, f"Stream degraded (YELLOW) for over {YELLOW_THRESHOLD_SECONDS // 60} minutes"
        
        return False, ""


# Global instance
health_service = HealthService()

