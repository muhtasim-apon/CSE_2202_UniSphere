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

# participation 5/5, class tests 8/10 & 6/10, assignment 9/10,
# midterm 20/25, final 40/50  ->  5 + 8 + 9 + 20 + 40 = 82
FULL_THEORY = {
    "participation": [(5, 5)],
    "class_test": [(8, 10), (6, 10)],
    "assignment": [(9, 10)],
    "midterm": [(20, 25)],
    "final": [(40, 50)],
}


def test_weights_sum_to_100():
    assert sum(THEORY_WEIGHTS.values()) == 100
    assert sum(LAB_WEIGHTS.values()) == 100


def test_theory_course_graded_once_out_of_100():
    r = grade_course(THEORY, FULL_THEORY)
    assert r["course_pct"] == 82.0
    assert r["grade"] == "A+"
    assert r["grade_points"] == 4.00
    assert r["is_complete"] is True


def test_class_test_takes_best_of_two_regardless_of_order():
    """§18.4 counts 'Class Test (Best 1 of 2)', not the mean."""
    reversed_order = dict(FULL_THEORY, class_test=[(6, 10), (8, 10)])
    assert grade_course(THEORY, reversed_order)["course_pct"] == 82.0
    # The mean would have contributed 7, giving 81.
    assert grade_course(THEORY, dict(FULL_THEORY, class_test=[(8, 10)]))["course_pct"] == 82.0


def test_course_without_final_is_incomplete():
    partial = {k: v for k, v in FULL_THEORY.items() if k != "final"}
    r = grade_course(THEORY, partial)
    assert r["is_complete"] is False
    assert r["course_pct"] == 42.0  # provisional only; excluded from CGPA


def test_lab_uses_lab_weights_and_capstone_gates_completion():
    full = {h: [(1, 1)] for h in LAB_WEIGHTS}
    r = grade_course(LAB, full)
    assert r["course_pct"] == 100.0
    assert r["grade"] == "A+"
    assert r["is_complete"] is True

    without_capstone = {h: [(1, 1)] for h in LAB_WEIGHTS if h != "capstone"}
    assert grade_course(LAB, without_capstone)["is_complete"] is False


def test_marks_above_total_are_clamped():
    r = grade_course(THEORY, dict(FULL_THEORY, final=[(80, 50)]))
    assert r["course_pct"] <= 100.0


def test_zero_total_marks_head_is_ignored_not_divided_by():
    r = grade_course(THEORY, dict(FULL_THEORY, participation=[(0, 0)]))
    assert r["course_pct"] == 77.0  # 82 minus the 5-mark participation head


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
