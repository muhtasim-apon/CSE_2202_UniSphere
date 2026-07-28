"""Curriculum-grading tests (DU CSE OBE §18.4 – §18.10).

`grade_course` is a pure function, so these run with no DB or network. Run from
the backend directory:  pytest tests/
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.classes import (  # noqa: E402
    LAB_WEIGHTS,
    THEORY_WEIGHTS,
    _grade_from_pct,
    grade_course,
)

THEORY = {"course_type": "theory"}
LAB = {"course_type": "lab"}

# Theory weights (DU CSE OBE §18.4, 2026 revision):
#   participation 5  +  class_test (best 1 of 2) 10  +  assignment 5
#   +  midterm 20  +  final 60  =  100
# Worked example: participation 5/5, class tests 8/10 & 6/10,
# assignment 9/10, midterm 20/20, final 40/60
#   -> 5 + (8/10)*10 + (9/10)*5 + 20 + (40/60)*60 = 5 + 8 + 4.5 + 20 + 40 = 77.5
FULL_THEORY = {
    "participation": [(5, 5)],
    "class_test": [(8, 10), (6, 10)],
    "assignment": [(9, 10)],
    "midterm": [(20, 20)],
    "final": [(40, 60)],
}


def test_weights_sum_to_100():
    assert sum(THEORY_WEIGHTS.values()) == 100
    assert sum(LAB_WEIGHTS.values()) == 100


def test_theory_course_graded_once_out_of_100():
    r = grade_course(THEORY, FULL_THEORY)
    assert r["course_pct"] == 77.5
    assert r["grade"] == "A"
    assert r["grade_points"] == 3.75
    assert r["is_complete"] is True


def test_class_test_takes_best_of_two_regardless_of_order():
    """§18.4 counts 'Class Test (Best 1 of 2)', not the mean."""
    reversed_order = dict(FULL_THEORY, class_test=[(6, 10), (8, 10)])
    assert grade_course(THEORY, reversed_order)["course_pct"] == 77.5
    # Only the best score counts: dropping the worse one gives the same total.
    assert grade_course(THEORY, dict(FULL_THEORY, class_test=[(8, 10)]))["course_pct"] == 77.5


def test_course_without_final_is_incomplete():
    partial = {k: v for k, v in FULL_THEORY.items() if k != "final"}
    r = grade_course(THEORY, partial)
    assert r["is_complete"] is False
    # 5 + 8 + 4.5 + 20 = 37.5 — provisional, excluded from CGPA.
    assert r["course_pct"] == 37.5


def test_lab_uses_lab_weights_and_capstone_gates_completion():
    full = {h: [(1, 1)] for h in LAB_WEIGHTS}
    r = grade_course(LAB, full)
    assert r["course_pct"] == 100.0
    assert r["grade"] == "A+"
    assert r["is_complete"] is True

    without_capstone = {h: [(1, 1)] for h in LAB_WEIGHTS if h != "capstone"}
    assert grade_course(LAB, without_capstone)["is_complete"] is False


def test_marks_above_total_are_clamped():
    r = grade_course(THEORY, dict(FULL_THEORY, final=[(80, 60)]))
    assert r["course_pct"] <= 100.0


def test_zero_total_marks_head_is_ignored_not_divided_by():
    r = grade_course(THEORY, dict(FULL_THEORY, participation=[(0, 0)]))
    assert r["course_pct"] == 72.5  # 77.5 minus the 5-mark participation head


def test_participation_from_attendance_pct_scales_into_weight():
    """§18.4 — Class Participation is derived from attendance %.

    Backend injects (pct, 100) for the participation head, so the contribution
    is (pct/100) × weight. Verify the resulting course_pct matches.
    """
    # 100% attendance → 5/5 on participation → 5 contribution (the max).
    full_attn = dict(FULL_THEORY, participation=[(100, 100)])
    assert grade_course(THEORY, full_attn)["course_pct"] == 77.5

    # 80% attendance → 0.8 × 5 = 4 contribution, all else unchanged from 77.5.
    # Original full contribution was 5; new is 4; delta = -1.
    partial_attn = dict(FULL_THEORY, participation=[(80, 100)])
    assert grade_course(THEORY, partial_attn)["course_pct"] == 76.5

    # 0% attendance → 0 contribution from participation.
    zero_attn = dict(FULL_THEORY, participation=[(0, 100)])
    assert grade_course(THEORY, zero_attn)["course_pct"] == 72.5


@pytest.mark.parametrize(
    "pct,grade,gp",
    [
        (80, "A+", 4.00), (79.99, "A", 3.75), (75, "A", 3.75),
        (70, "A-", 3.50), (65, "B+", 3.25), (60, "B", 3.00),
        (55, "B-", 2.75), (50, "C+", 2.50), (45, "C", 2.25),
        (40, "D", 2.00), (39.99, "F", 0.00), (0, "F", 0.00),
    ],
)
def test_grade_scale_boundaries(pct, grade, gp):
    """§18.8 uniform UGC grading table."""
    assert _grade_from_pct(pct) == (grade, gp)
