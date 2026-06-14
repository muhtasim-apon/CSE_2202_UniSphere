  
**UNIVERSITY ERP**

Database Design Report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Full PostgreSQL DDL | 30+ Tables | 3NF Normalized*

Google Classroom Module | University ERP Module | Campus Module | RBAC

**DBMS Course Project**

2026

# **1\. System Overview**

This document describes the complete database design for a University ERP system built for PostgreSQL. The system manages the full academic lifecycle of a university: from student admissions, course management, and grading to Google Classroom–style content delivery, teacher reviews, hall management, and transport tracking.

## **1.1 Design Goals**

* 3NF normalized schema with 30+ tables across 4 functional modules

* Comprehensive constraint coverage: PK, FK with ON DELETE/UPDATE rules, UNIQUE, CHECK, NOT NULL

* PostgreSQL triggers for automatic CGPA calculation and count maintenance

* Stored procedures for critical workflows (enrollment, teacher review submission)

* 6 dashboard views for Students, Teachers, Admins, and Attendance tracking

* Role-Based Access Control (RBAC) with Permission and Role\_Permission tables

* Google Classroom-style content delivery: posts, materials, assignments, discussions

* 5 unique features: Teacher Review System, Hall Management, Transport Tracking, Appointment Scheduling, Earned Achievement System

## **1.2 Technology**

**DBMS:** PostgreSQL 15+

**Extensions:** pgcrypto (for password hashing with bcrypt)

**Language:** PL/pgSQL (triggers and stored procedures)

**Normal Form:** 3NF (all tables verified)

# **2\. Schema Modules & Tables**

The database is organized into 5 functional modules, each grouping related tables. All 35 tables are listed below with their attributes and constraints.

| Module | Tables | Purpose |
| ----- | ----- | ----- |
| Academic Infrastructure | Building, Classroom, Department, Program, Semester, TimeSlot | Physical and academic structure of the university |
| Users & People | Users, Instructor, Staff, Student | All people in the system with role-based auth |
| Course & Scheduling | Course, Course\_Prerequisite, Section, Section\_Schedule, Enrollment, Attendance, Assessment, Assessment\_Result, Student\_Advisor | Full academic workflow from course design to grading |
| Google Classroom | Classroom\_Post, Course\_Material, Assignment, Assignment\_Submission, Discussion\_Thread, Discussion\_Reply | LMS-style content delivery and interaction |
| University Services | Notice, Event, Event\_Registration, Appointment, Teacher\_Review, Hall, Hall\_Allocation, Transport\_Route, Transport\_Subscription, Permission, Role\_Permission | Campus services, reviews, and access control |

## **2.1 Table Schemas with Constraints**

| Table | Attributes | Constraints |
| ----- | ----- | ----- |
| Building | building\_id, building\_name, address, total\_floors, built\_year, is\_active | PK: building\_id | UNIQUE: building\_name | CHECK: total\_floors 1-50 |
| Classroom | room\_id, building\_id, room\_number, floor\_number, capacity, room\_type, has\_projector, has\_ac, is\_active | PK: room\_id | FK: building\_id→Building | UNIQUE: (building\_id, room\_number) | CHECK: room\_type, capacity |
| Department | dept\_id, dept\_name, dept\_code, description, office\_location, phone, email, established, is\_active | PK: dept\_id | UNIQUE: dept\_name, dept\_code, email | CHECK: email format |
| Program | program\_id, dept\_id, program\_name, program\_code, degree\_level, duration\_years, total\_credits, is\_active | PK: program\_id | FK: dept\_id→Department | UNIQUE: program\_code | CHECK: degree\_level enum, duration |
| Semester | semester\_id, semester\_name, year, term, start\_date, end\_date, is\_current, registration\_open, registration\_close | PK: semester\_id | UNIQUE: (year,term) | CHECK: date ordering, term enum |
| TimeSlot | slot\_id, slot\_name, day\_of\_week, start\_time, end\_time | PK: slot\_id | UNIQUE: slot\_name | CHECK: start\_time \< end\_time, day enum |
| Users | user\_id, username, email, password\_hash, role, is\_active, last\_login, created\_at, updated\_at | PK: user\_id | UNIQUE: username, email | CHECK: email format, role enum |
| Instructor | instructor\_id, user\_id, dept\_id, first\_name, last\_name, gender, date\_of\_birth, phone, office\_location, hire\_date, employee\_id, designation, specialization, bio, profile\_photo, is\_active | PK: instructor\_id | FK: user\_id→Users, dept\_id→Department | UNIQUE: user\_id, employee\_id | CHECK: designation enum |
| Staff | staff\_id, user\_id, dept\_id, first\_name, last\_name, gender, date\_of\_birth, phone, hire\_date, employee\_id, category, position\_title, salary, is\_active | PK: staff\_id | FK: user\_id→Users | UNIQUE: user\_id, employee\_id | CHECK: salary≥0, category enum |
| Student | student\_id, user\_id, program\_id, first\_name, last\_name, gender, date\_of\_birth, phone, address, student\_roll, admission\_date, batch\_year, current\_semester, cgpa, total\_credits, profile\_photo, emergency\_contact\_name, emergency\_contact\_phone, is\_active | PK: student\_id | FK: user\_id→Users, program\_id→Program | UNIQUE: user\_id, student\_roll | CHECK: cgpa 0-4, semester 1-20 |
| Course | course\_id, dept\_id, course\_code, course\_name, description, credit\_hours, theory\_hours, lab\_hours, level, is\_elective, is\_active | PK: course\_id | FK: dept\_id→Department | UNIQUE: course\_code | CHECK: credit\_hours 0.5-6, level enum |
| Course\_Prerequisite | course\_id, prereq\_id, min\_grade | PK: (course\_id, prereq\_id) | FK: both→Course | CHECK: course\_id ≠ prereq\_id |
| Section | section\_id, course\_id, semester\_id, instructor\_id, room\_id, section\_number, max\_capacity, enrolled\_count, is\_online, syllabus\_url, meet\_link, is\_active | PK: section\_id | FK: course\_id, semester\_id, instructor\_id, room\_id | UNIQUE: (course\_id, semester\_id, section\_number) | CHECK: enrolled\_count ≤ max\_capacity |
| Section\_Schedule | schedule\_id, section\_id, slot\_id, room\_id | PK: schedule\_id | FK: section\_id, slot\_id, room\_id | UNIQUE: (section\_id, slot\_id) |
| Enrollment | enrollment\_id, student\_id, section\_id, semester\_id, enrolled\_at, status, grade, grade\_points | PK: enrollment\_id | FK: student\_id, section\_id, semester\_id | UNIQUE: (student\_id, section\_id) | CHECK: grade values, grade\_points 0-4, status enum |
| Attendance | attendance\_id, enrollment\_id, class\_date, status, remarks, recorded\_by, recorded\_at | PK: attendance\_id | FK: enrollment\_id, recorded\_by | UNIQUE: (enrollment\_id, class\_date) | CHECK: status enum |
| Assessment | assessment\_id, section\_id, title, type, total\_marks, weightage, scheduled\_date, due\_date, description, is\_published | PK: assessment\_id | FK: section\_id | CHECK: type enum, total\_marks\>0, weightage 0-100 |
| Assessment\_Result | result\_id, assessment\_id, enrollment\_id, marks\_obtained, feedback, graded\_by, graded\_at | PK: result\_id | FK: assessment\_id, enrollment\_id, graded\_by | UNIQUE: (assessment\_id, enrollment\_id) | CHECK: marks\_obtained≥0 |
| Student\_Advisor | advisor\_id, student\_id, instructor\_id, semester\_id, assigned\_date, notes | PK: advisor\_id | FK: student\_id, instructor\_id, semester\_id | UNIQUE: (student\_id, semester\_id) |
| Classroom\_Post | post\_id, section\_id, posted\_by, post\_type, title, content, is\_pinned, allow\_comments, scheduled\_at, published\_at, updated\_at | PK: post\_id | FK: section\_id, posted\_by | CHECK: post\_type enum |
| Course\_Material | material\_id, section\_id, post\_id, uploaded\_by, title, description, file\_url, file\_type, file\_size\_kb, topic, is\_visible, uploaded\_at | PK: material\_id | FK: section\_id, post\_id, uploaded\_by | CHECK: file\_size\_kb\>0 |
| Assignment | assignment\_id, section\_id, assessment\_id, post\_id, created\_by, title, description, instructions, due\_date, max\_marks, allow\_late, late\_penalty\_pct, attachment\_url, is\_published | PK: assignment\_id | FK: section\_id, assessment\_id, post\_id, created\_by | CHECK: max\_marks\>0, penalty 0-100 |
| Assignment\_Submission | submission\_id, assignment\_id, student\_id, submitted\_at, submission\_url, submission\_text, status, marks\_obtained, feedback, graded\_at, graded\_by | PK: submission\_id | FK: assignment\_id, student\_id, graded\_by | UNIQUE: (assignment\_id, student\_id) | CHECK: status enum |
| Discussion\_Thread | thread\_id, section\_id, post\_id, created\_by, title, body, is\_closed, is\_pinned, views, created\_at, updated\_at | PK: thread\_id | FK: section\_id, post\_id, created\_by | CHECK: views≥0 |
| Discussion\_Reply | reply\_id, thread\_id, replied\_by, parent\_reply\_id, body, is\_solution, upvotes, created\_at, updated\_at | PK: reply\_id | FK: thread\_id, replied\_by, parent\_reply\_id (self-ref) | CHECK: upvotes≥0 |
| Notice | notice\_id, posted\_by, dept\_id, title, body, audience, priority, is\_published, publish\_date, expiry\_date, attachment\_url, views | PK: notice\_id | FK: posted\_by, dept\_id | CHECK: audience enum, priority 1-5, expiry\>publish |
| Event | event\_id, organized\_by, dept\_id, room\_id, title, description, event\_type, start\_datetime, end\_datetime, venue, max\_participants, registration\_required, registration\_deadline, is\_public, banner\_url | PK: event\_id | FK: organized\_by, dept\_id, room\_id | CHECK: start\<end, deadline≤start, event\_type enum |
| Event\_Registration | reg\_id, event\_id, user\_id, registered\_at, attended | PK: reg\_id | FK: event\_id, user\_id | UNIQUE: (event\_id, user\_id) |
| Appointment | appointment\_id, student\_id, instructor\_id, requested\_at, scheduled\_datetime, duration\_minutes, purpose, notes, status, location, meet\_link, cancelled\_reason | PK: appointment\_id | FK: student\_id, instructor\_id | CHECK: duration 5-240, status enum |
| Teacher\_Review | review\_id, instructor\_id, student\_id, section\_id, semester\_id, rating\_teaching, rating\_communication, rating\_punctuality, rating\_fairness, rating\_helpfulness, overall\_rating (GENERATED), written\_review, is\_anonymous, status, submitted\_at | PK: review\_id | FK: instructor\_id, student\_id, section\_id, semester\_id | UNIQUE: (student\_id, section\_id, semester\_id) | CHECK: all ratings 1-5, status enum | GENERATED: overall\_rating |
| Hall | hall\_id, building\_id, hall\_name, hall\_type, total\_rooms, total\_capacity, warden\_staff\_id, facilities, monthly\_fee, is\_active | PK: hall\_id | FK: building\_id, warden\_staff\_id | UNIQUE: hall\_name | CHECK: hall\_type enum, rooms\>0 |
| Hall\_Allocation | allocation\_id, hall\_id, student\_id, room\_number, bed\_number, allocated\_from, allocated\_to, is\_current, monthly\_fee | PK: allocation\_id | FK: hall\_id, student\_id | CHECK: allocated\_to \> allocated\_from |
| Transport\_Route | route\_id, route\_name, route\_code, origin, destination, stops, departure\_time, arrival\_time, transport\_type, vehicle\_number, driver\_name, driver\_phone, capacity, monthly\_fee, is\_active | PK: route\_id | UNIQUE: route\_name, route\_code | CHECK: departure\<arrival, transport\_type enum, capacity\>0 |
| Transport\_Subscription | sub\_id, route\_id, student\_id, start\_date, end\_date, is\_active, monthly\_fee\_paid | PK: sub\_id | FK: route\_id, student\_id | UNIQUE: (route\_id, student\_id) | CHECK: end\>start |
| Permission | perm\_id, perm\_name, description, module | PK: perm\_id | UNIQUE: perm\_name |
| Role\_Permission | role, perm\_id, granted\_at | PK: (role, perm\_id) | FK: perm\_id→Permission | CHECK: role enum |

# **3\. Entity-Relationship Diagram Description**

The ER diagram (crow's foot notation) captures all entity sets and their relationships. Key relationships are described below:

## **3.1 Core Entities and Cardinalities**

| Entity A | Relationship | Entity B | Cardinality |
| ----- | ----- | ----- | ----- |
| Department | has many | Program | 1 : N |
| Program | enrolls many | Student | 1 : N |
| Department | employs many | Instructor | 1 : N |
| Student | is a type of | Users | 1 : 1 |
| Instructor | is a type of | Users | 1 : 1 |
| Course | has prerequisite | Course | M : N (self-referential) |
| Instructor | teaches many | Section | 1 : N |
| Course | offered as many | Section | 1 : N |
| Semester | contains many | Section | 1 : N |
| Student | enrolls in many | Section | M : N (via Enrollment) |
| Enrollment | tracks many | Attendance | 1 : N |
| Section | has many | Assessment | 1 : N |
| Assessment | has many | Assessment\_Result | 1 : N |
| Section | has many | Classroom\_Post | 1 : N |
| Section | has many | Assignment | 1 : N |
| Student | submits many | Assignment\_Submission | 1 : N |
| Section | has many | Discussion\_Thread | 1 : N |
| Discussion\_Thread | has many | Discussion\_Reply | 1 : N (recursive self-ref for replies) |
| Student | books | Appointment | M : N (via Appointment table) |
| Student | reviews | Instructor | M : N (via Teacher\_Review) |
| Student | lives in | Hall | M : N (via Hall\_Allocation) |
| Student | uses | Transport\_Route | M : N (via Transport\_Subscription) |
| Event | has many | Event\_Registration | 1 : N |
| Role | has many | Permission | M : N (via Role\_Permission) |

# **4\. Functional Dependencies & Normalization**

All tables are verified to be in Third Normal Form (3NF). For each table, the non-trivial functional dependencies are listed, along with candidate keys and normalization status.

## **4.1 Non-Trivial Functional Dependencies**

| Table | Primary FD | Candidate Key (Alt) | Normal Form Status |
| ----- | ----- | ----- | ----- |
| Student | student\_id → {first\_name, last\_name, email, program\_id, cgpa, student\_roll, batch\_year} | student\_roll → student\_id (candidate key) | BCNF: student\_id is sole determinant of all non-key attrs |
| Enrollment | (student\_id, section\_id) → {grade, grade\_points, status, enrolled\_at} | enrollment\_id → {student\_id, section\_id, semester\_id} | BCNF verified; no partial/transitive dependency |
| Section | section\_id → {course\_id, semester\_id, instructor\_id, room\_id, max\_capacity} | (course\_id, semester\_id, section\_number) → section\_id (candidate key) | BCNF: section\_id is sole determinant |
| Course | course\_id → {course\_name, credit\_hours, dept\_id, level} | course\_code → course\_id (candidate key) | BCNF verified |
| Teacher\_Review | (student\_id, section\_id, semester\_id) → {ratings, written\_review} | review\_id → all fields | overall\_rating is computed (GENERATED ALWAYS) — not a FD violation |
| Attendance | (enrollment\_id, class\_date) → {status, remarks, recorded\_by} | attendance\_id → all fields | BCNF; composite candidate key ensures no partial dependency |
| Assessment\_Result | (assessment\_id, enrollment\_id) → {marks\_obtained, feedback, graded\_at} | result\_id → all fields | BCNF verified |
| Hall\_Allocation | (hall\_id, student\_id) → {room\_number, bed\_number, allocated\_from} | allocation\_id → all fields | BCNF: no non-trivial transitive FDs |
| Transport\_Subscription | (route\_id, student\_id) → {start\_date, end\_date, monthly\_fee\_paid} | sub\_id → all fields | BCNF verified |
| Instructor | instructor\_id → all attributes | employee\_id → instructor\_id (candidate key) | BCNF: instructor\_id is sole determinant |

## **4.2 3NF Verification Summary**

A relation R is in 3NF if for every non-trivial FD X → A, either (a) X is a superkey of R, or (b) A is a prime attribute (part of some candidate key).

* No table contains partial dependencies (all non-key attributes depend on the full primary key).

* No table contains transitive dependencies (no non-key attribute determines another non-key attribute).

* The overall\_rating in Teacher\_Review is a GENERATED ALWAYS computed column — not a stored FD, hence not a normalization concern.

* The enrolled\_count in Section is a denormalized cache maintained by trigger trg\_enrolled\_count; it is justified by performance and is deterministically computed from Enrollment.

* All foreign key relationships represent IS-A or association relationships, not hidden transitive FDs.

# **5\. Complete SQL DDL**

The following is the complete PostgreSQL DDL script. Copy this directly into psql or any PostgreSQL client to create the database.

## **5.1 DDL Script Preview (Key Sections)**

### **Extensions & Enums**

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  
   
CREATE TYPE gender\_type AS ENUM ('Male', 'Female', 'Other');  
CREATE TYPE enrollment\_status AS ENUM ('Enrolled','Dropped','Completed','Waitlisted');  
CREATE TYPE attendance\_status AS ENUM ('Present','Absent','Late','Excused');  
CREATE TYPE submission\_status AS ENUM ('Submitted','Late','Not\_Submitted','Graded');  
CREATE TYPE review\_status AS ENUM ('Approved','Pending','Rejected');  
\-- ... (see full SQL file for all enum types)

### **Student Table (Representative Example)**

CREATE TABLE Student (  
    student\_id      SERIAL PRIMARY KEY,  
    user\_id         INT NOT NULL UNIQUE REFERENCES Users(user\_id)  
                        ON DELETE CASCADE ON UPDATE CASCADE,  
    program\_id      INT NOT NULL REFERENCES Program(program\_id)  
                        ON DELETE RESTRICT ON UPDATE CASCADE,  
    first\_name      VARCHAR(60) NOT NULL,  
    last\_name       VARCHAR(60) NOT NULL,  
    gender          gender\_type,  
    date\_of\_birth   DATE NOT NULL CHECK (date\_of\_birth \< CURRENT\_DATE),  
    student\_roll    VARCHAR(30) NOT NULL UNIQUE,  
    admission\_date  DATE NOT NULL DEFAULT CURRENT\_DATE,  
    batch\_year      SMALLINT NOT NULL CHECK (batch\_year BETWEEN 2000 AND 2100),  
    current\_semester SMALLINT NOT NULL DEFAULT 1 CHECK (current\_semester BETWEEN 1 AND 20),  
    cgpa            NUMERIC(4,2) DEFAULT 0.00 CHECK (cgpa BETWEEN 0 AND 4.00),  
    total\_credits   SMALLINT NOT NULL DEFAULT 0 CHECK (total\_credits \>= 0),  
    is\_active       BOOLEAN NOT NULL DEFAULT TRUE  
);

### **Teacher\_Review Table (Unique Feature)**

CREATE TABLE Teacher\_Review (  
    review\_id       SERIAL PRIMARY KEY,  
    instructor\_id   INT NOT NULL REFERENCES Instructor(instructor\_id)  
                        ON DELETE CASCADE ON UPDATE CASCADE,  
    student\_id      INT NOT NULL REFERENCES Student(student\_id)  
                        ON DELETE CASCADE ON UPDATE CASCADE,  
    section\_id      INT NOT NULL REFERENCES Section(section\_id)  
                        ON DELETE CASCADE ON UPDATE CASCADE,  
    semester\_id     INT NOT NULL REFERENCES Semester(semester\_id)  
                        ON DELETE RESTRICT ON UPDATE CASCADE,  
    rating\_teaching     SMALLINT NOT NULL CHECK (rating\_teaching BETWEEN 1 AND 5),  
    rating\_communication SMALLINT NOT NULL CHECK (rating\_communication BETWEEN 1 AND 5),  
    rating\_punctuality  SMALLINT NOT NULL CHECK (rating\_punctuality BETWEEN 1 AND 5),  
    rating\_fairness     SMALLINT NOT NULL CHECK (rating\_fairness BETWEEN 1 AND 5),  
    rating\_helpfulness  SMALLINT NOT NULL CHECK (rating\_helpfulness BETWEEN 1 AND 5),  
    overall\_rating  NUMERIC(3,2) GENERATED ALWAYS AS (  
        (rating\_teaching \+ rating\_communication \+ rating\_punctuality  
         \+ rating\_fairness \+ rating\_helpfulness)::NUMERIC / 5  
    ) STORED,  
    is\_anonymous    BOOLEAN NOT NULL DEFAULT TRUE,  
    status          review\_status NOT NULL DEFAULT 'Pending',  
    UNIQUE (student\_id, section\_id, semester\_id)  
);

### **CGPA Auto-Calculation Trigger**

CREATE OR REPLACE FUNCTION update\_student\_cgpa()  
RETURNS TRIGGER AS $$  
DECLARE  
    v\_student\_id INT;  
    v\_total\_weighted NUMERIC := 0;  
    v\_total\_credits  NUMERIC := 0;  
BEGIN  
    SELECT student\_id INTO v\_student\_id FROM Enrollment  
    WHERE enrollment\_id \= NEW.enrollment\_id;  
   
    SELECT COALESCE(SUM(e.grade\_points \* c.credit\_hours), 0),  
           COALESCE(SUM(CASE WHEN e.grade\_points IS NOT NULL  
                        THEN c.credit\_hours ELSE 0 END), 0\)  
    INTO v\_total\_weighted, v\_total\_credits  
    FROM Enrollment e  
    JOIN Section s ON s.section\_id \= e.section\_id  
    JOIN Course c  ON c.course\_id  \= s.course\_id  
    WHERE e.student\_id \= v\_student\_id AND e.status \= 'Completed';  
   
    UPDATE Student  
    SET cgpa \= ROUND(v\_total\_weighted / NULLIF(v\_total\_credits, 0), 2\)  
    WHERE student\_id \= v\_student\_id;  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;  
   
CREATE TRIGGER trg\_update\_cgpa  
AFTER INSERT OR UPDATE OF grade\_points ON Enrollment  
FOR EACH ROW WHEN (NEW.grade\_points IS NOT NULL)  
EXECUTE FUNCTION update\_student\_cgpa();

# **6\. SQL Queries**

Below are 16 SQL queries demonstrating all required SQL features: natural join, cross product, outer join, join with USING/ON, nested subqueries with EXISTS/ALL/ANY, subqueries in FROM/WHERE/SELECT, GROUP BY/HAVING/ORDER BY, WITH clause, string manipulation, set operations, UPDATE/DELETE, aggregate functions, and view usage.

### **1\. Natural Join — Students with Their Program**

Demonstrates NATURAL JOIN between Student and Program on the shared program\_id column.

SELECT s.student\_roll, s.first\_name, s.last\_name, p.program\_name, d.dept\_name  
FROM Student s  
  NATURAL JOIN Program p   \-- matches on program\_id  
  JOIN Department d ON d.dept\_id \= p.dept\_id  
WHERE s.is\_active \= TRUE  
ORDER BY s.student\_roll;

### **2\. Cross Product — All Student-Section Combinations (filtered)**

Shows implicit cross product (Cartesian join) with manual WHERE conditions for filtering.

SELECT s.student\_roll, sec.section\_number, c.course\_code  
FROM Student s, Section sec, Course c  
WHERE sec.course\_id \= c.course\_id  
  AND sec.semester\_id \= (SELECT semester\_id FROM Semester WHERE is\_current \= TRUE)  
ORDER BY s.student\_roll, c.course\_code;

### **3\. LEFT OUTER JOIN — Students and Their Hall Allocation**

Retrieves all students, including those not living in halls (NULL for hall fields).

SELECT s.student\_roll, s.first\_name, h.hall\_name, ha.room\_number  
FROM Student s  
LEFT OUTER JOIN Hall\_Allocation ha ON ha.student\_id \= s.student\_id AND ha.is\_current \= TRUE  
LEFT OUTER JOIN Hall h ON h.hall\_id \= ha.hall\_id  
ORDER BY s.student\_roll;

### **4\. JOIN with USING — Enrollment by Semester**

Demonstrates JOIN ... USING syntax across four tables with shared column names.

SELECT e.enrollment\_id, s.first\_name, c.course\_name, sem.semester\_name  
FROM Enrollment e  
JOIN Student s USING (student\_id)  
JOIN Section sec USING (section\_id)  
JOIN Course c USING (course\_id)  
JOIN Semester sem USING (semester\_id)  
WHERE e.status \= 'Enrolled'  
ORDER BY sem.year DESC, s.last\_name;

### **5\. Subquery with EXISTS — Students Who Submitted All Assignments**

Nested EXISTS: finds students who have submitted every published assignment in their enrolled sections.

SELECT s.student\_roll, s.first\_name, s.last\_name  
FROM Student s  
WHERE EXISTS (  
  SELECT 1 FROM Enrollment e  
  WHERE e.student\_id \= s.student\_id  
    AND e.status \= 'Enrolled'  
    AND NOT EXISTS (  
      SELECT 1 FROM Assignment a  
      JOIN Section sec ON sec.section\_id \= a.section\_id  
      WHERE sec.section\_id \= e.section\_id  
        AND a.is\_published \= TRUE  
        AND NOT EXISTS (  
          SELECT 1 FROM Assignment\_Submission sub  
          WHERE sub.assignment\_id \= a.assignment\_id  
            AND sub.student\_id \= s.student\_id  
        )  
    )  
);

### **6\. Subquery with ALL — Courses Above All Average Mark Thresholds**

Uses ALL to find courses whose average score exceeds every other course's average.

SELECT c.course\_code, c.course\_name,  
       ROUND(AVG(ar.marks\_obtained / a.total\_marks \* 100), 2\) AS avg\_score\_pct  
FROM Course c  
JOIN Section sec ON sec.course\_id \= c.course\_id  
JOIN Assessment a ON a.section\_id \= sec.section\_id  
JOIN Assessment\_Result ar ON ar.assessment\_id \= a.assessment\_id  
GROUP BY c.course\_id, c.course\_code, c.course\_name  
HAVING AVG(ar.marks\_obtained / a.total\_marks \* 100\) \> ALL (  
  SELECT AVG(ar2.marks\_obtained / a2.total\_marks \* 100\)  
  FROM Section sec2  
  JOIN Assessment a2 ON a2.section\_id \= sec2.section\_id  
  JOIN Assessment\_Result ar2 ON ar2.assessment\_id \= a2.assessment\_id  
  WHERE sec2.course\_id \<\> c.course\_id  
  GROUP BY sec2.course\_id  
);

### **7\. Scalar Subquery in SELECT — Student CGPA with Class Rank**

Scalar subquery in SELECT computes class rank for each student within their program.

SELECT s.student\_roll, s.first\_name, s.last\_name, s.cgpa,  
  (SELECT COUNT(\*) FROM Student s2  
   WHERE s2.program\_id \= s.program\_id  
     AND s2.cgpa \> s.cgpa  
     AND s2.is\_active \= TRUE) \+ 1 AS class\_rank  
FROM Student s  
WHERE s.is\_active \= TRUE  
ORDER BY s.program\_id, class\_rank;

### **8\. Subquery in FROM — Top Reviewed Instructors**

Subquery in FROM (derived table) computes instructor review rankings with a minimum review threshold.

SELECT ranked.instructor\_name, ranked.designation, ranked.dept\_name,  
       ranked.avg\_rating, ranked.review\_count  
FROM (  
  SELECT i.first\_name || ' ' || i.last\_name AS instructor\_name,  
         i.designation, d.dept\_name,  
         ROUND(AVG(tr.overall\_rating), 2\) AS avg\_rating,  
         COUNT(tr.review\_id) AS review\_count  
  FROM Teacher\_Review tr  
  JOIN Instructor i ON i.instructor\_id \= tr.instructor\_id  
  JOIN Department d ON d.dept\_id \= i.dept\_id  
  WHERE tr.status \= 'Approved'  
  GROUP BY i.instructor\_id, i.first\_name, i.last\_name, i.designation, d.dept\_name  
  HAVING COUNT(tr.review\_id) \>= 5  
) ranked  
ORDER BY ranked.avg\_rating DESC  
LIMIT 10;

### **9\. GROUP BY, HAVING, ORDER BY — Attendance Analysis**

GROUP BY with FILTER aggregate and HAVING to find students with attendance below 75%.

SELECT s.student\_roll, s.first\_name || ' ' || s.last\_name AS student\_name,  
       c.course\_code,  
       COUNT(a.attendance\_id) AS total\_classes,  
       COUNT(a.attendance\_id) FILTER (WHERE a.status \= 'Present') AS present,  
       ROUND(100.0 \* COUNT(a.attendance\_id) FILTER (WHERE a.status IN ('Present','Late'))  
             / NULLIF(COUNT(a.attendance\_id), 0), 2\) AS attendance\_pct  
FROM Enrollment e  
JOIN Student s ON s.student\_id \= e.student\_id  
JOIN Section sec ON sec.section\_id \= e.section\_id  
JOIN Course c ON c.course\_id \= sec.course\_id  
LEFT JOIN Attendance a ON a.enrollment\_id \= e.enrollment\_id  
GROUP BY s.student\_id, s.student\_roll, s.first\_name, s.last\_name, c.course\_code  
HAVING ROUND(100.0 \* COUNT(a.attendance\_id) FILTER (WHERE a.status IN ('Present','Late'))  
             / NULLIF(COUNT(a.attendance\_id), 0), 2\) \< 75  
ORDER BY attendance\_pct ASC;

### **10\. WITH Clause (CTE) — CGPA Trend by Semester**

WITH clause (CTE) with window function RANK() to find top-5 GPA students per semester.

WITH semester\_gpa AS (  
  SELECT e.student\_id, e.semester\_id, sem.semester\_name, sem.year,  
         ROUND(SUM(e.grade\_points \* c.credit\_hours) /  
               NULLIF(SUM(c.credit\_hours), 0), 2\) AS sem\_gpa  
  FROM Enrollment e  
  JOIN Section sec ON sec.section\_id \= e.section\_id  
  JOIN Course c ON c.course\_id \= sec.course\_id  
  JOIN Semester sem ON sem.semester\_id \= e.semester\_id  
  WHERE e.grade\_points IS NOT NULL  
  GROUP BY e.student\_id, e.semester\_id, sem.semester\_name, sem.year  
),  
ranked AS (  
  SELECT sg.student\_id, sg.semester\_name, sg.year, sg.sem\_gpa,  
         RANK() OVER (PARTITION BY sg.semester\_id ORDER BY sg.sem\_gpa DESC) AS rank\_in\_sem  
  FROM semester\_gpa sg  
)  
SELECT s.student\_roll, s.first\_name, r.semester\_name, r.sem\_gpa, r.rank\_in\_sem  
FROM ranked r  
JOIN Student s ON s.student\_id \= r.student\_id  
WHERE r.rank\_in\_sem \<= 5  
ORDER BY r.year, r.rank\_in\_sem;

### **11\. String Manipulation — Format Student Report Card**

Demonstrates UPPER, INITCAP, CONCAT, TO\_CHAR, SUBSTRING, POSITION string functions.

SELECT  
  UPPER(s.student\_roll) AS roll,  
  INITCAP(s.first\_name || ' ' || s.last\_name) AS full\_name,  
  CONCAT(p.degree\_level, ' in ', p.program\_name) AS program,  
  'CGPA: ' || TO\_CHAR(s.cgpa, 'FM0.00') AS cgpa\_str,  
  'Batch ' || s.batch\_year::TEXT || ' | Sem ' || s.current\_semester::TEXT AS batch\_info,  
  SUBSTRING(u.email FROM 1 FOR POSITION('@' IN u.email) \- 1\) AS email\_username  
FROM Student s  
JOIN Program p ON p.program\_id \= s.program\_id  
JOIN Users u ON u.user\_id \= s.user\_id  
WHERE s.is\_active \= TRUE  
ORDER BY s.student\_roll;

### **12\. Set Operations — Students in CSE vs BBA Programs**

UNION set operation combining results from two different program queries.

\-- Students in CSE program  
SELECT s.student\_roll, s.first\_name || ' ' || s.last\_name AS name, 'CSE' AS dept  
FROM Student s JOIN Program p ON p.program\_id \= s.program\_id  
WHERE p.program\_code LIKE '%CS%' AND s.is\_active \= TRUE  
   
UNION  
   
\-- Students in BBA program  
SELECT s.student\_roll, s.first\_name || ' ' || s.last\_name, 'BBA' AS dept  
FROM Student s JOIN Program p ON p.program\_id \= s.program\_id  
WHERE p.program\_code \= 'BBA' AND s.is\_active \= TRUE  
   
ORDER BY dept, student\_roll;

### **13\. UPDATE with Subquery — Publish Pending Reviews**

UPDATE using a subquery to conditionally approve teacher reviews older than 7 days.

UPDATE Teacher\_Review  
SET status \= 'Approved'  
WHERE status \= 'Pending'  
  AND submitted\_at \< NOW() \- INTERVAL '7 days'  
  AND instructor\_id IN (  
    SELECT i.instructor\_id  
    FROM Instructor i  
    WHERE i.is\_active \= TRUE  
      AND i.dept\_id IN (SELECT dept\_id FROM Department WHERE is\_active \= TRUE)  
  );

### **14\. DELETE with Subquery — Remove Inactive Subscriptions**

DELETE using NOT IN subquery to remove stale transport subscriptions for inactive students.

DELETE FROM Transport\_Subscription  
WHERE is\_active \= FALSE  
  AND end\_date \< NOW() \- INTERVAL '1 year'  
  AND student\_id NOT IN (  
    SELECT student\_id FROM Student WHERE is\_active \= TRUE  
  );

### **15\. Built-in Aggregate Functions — Department Statistics**

Comprehensive aggregate functions: COUNT, AVG, MAX, MIN with FILTER, STDDEV, SUM across departments.

SELECT  
  d.dept\_name,  
  COUNT(DISTINCT s.student\_id)    AS total\_students,  
  COUNT(DISTINCT i.instructor\_id) AS total\_instructors,  
  COUNT(DISTINCT p.program\_id)    AS total\_programs,  
  ROUND(AVG(s.cgpa), 2\)          AS avg\_cgpa,  
  MAX(s.cgpa)                    AS highest\_cgpa,  
  MIN(s.cgpa) FILTER (WHERE s.cgpa \> 0\) AS lowest\_cgpa,  
  ROUND(STDDEV(s.cgpa), 4\)       AS cgpa\_stddev,  
  SUM(s.total\_credits)           AS total\_credits\_earned  
FROM Department d  
LEFT JOIN Program p ON p.dept\_id \= d.dept\_id  
LEFT JOIN Student s ON s.program\_id \= p.program\_id AND s.is\_active \= TRUE  
LEFT JOIN Instructor i ON i.dept\_id \= d.dept\_id AND i.is\_active \= TRUE  
WHERE d.is\_active \= TRUE  
GROUP BY d.dept\_id, d.dept\_name  
ORDER BY total\_students DESC;

### **16\. View Usage — Teacher Review Dashboard**

Querying the pre-built teacher review summary and dashboard views.

\-- Using pre-built view  
SELECT \* FROM v\_teacher\_review\_summary  
WHERE avg\_overall \>= 4.0  
ORDER BY avg\_overall DESC, review\_count DESC;  
   
\-- Using teacher dashboard view for current semester  
SELECT full\_name, designation, dept\_name,  
       current\_sections, total\_students, avg\_review\_rating  
FROM v\_teacher\_dashboard  
WHERE avg\_review\_rating IS NOT NULL  
ORDER BY avg\_review\_rating DESC;

# **7\. Views**

Six views are defined for different stakeholder dashboards and commonly needed data.

| View Name | Target User | Content |
| ----- | ----- | ----- |
| v\_student\_dashboard | Student | Student roll, program, CGPA, active courses, hall status |
| v\_teacher\_dashboard | Faculty | Sections, student count, average review rating |
| v\_admin\_dashboard | Admin | System-wide counts: students, staff, sections, enrollments |
| v\_attendance\_summary | Faculty/Admin | Per-enrollment attendance with percentage |
| v\_course\_results | All | Grade transcript view per student per semester |
| v\_teacher\_review\_summary | Admin/Faculty | Per-instructor per-semester aggregated ratings |

## **Example View Usage**

\-- Student dashboard (called by student portal)  
SELECT \* FROM v\_student\_dashboard WHERE student\_id \= 1;  
   
\-- Admin system overview  
SELECT \* FROM v\_admin\_dashboard;  
   
\-- Students with low attendance (from view)  
SELECT student\_name, course\_code, attendance\_pct  
FROM v\_attendance\_summary  
WHERE attendance\_pct \< 75  
ORDER BY attendance\_pct;

# **8\. Triggers & Stored Procedures**

## **8.1 Triggers**

| Trigger | Event | Purpose |
| ----- | ----- | ----- |
| trg\_update\_cgpa | AFTER INSERT/UPDATE ON Enrollment | Auto-recalculates student CGPA using weighted GPA formula |
| trg\_enrolled\_count | AFTER INSERT/UPDATE/DELETE ON Enrollment | Keeps Section.enrolled\_count in sync with actual enrollments |
| trg\_users\_updated\_at | BEFORE UPDATE ON Users | Auto-stamps updated\_at timestamp |
| trg\_discussion\_thread\_updated\_at | BEFORE UPDATE ON Discussion\_Thread | Auto-stamps updated\_at |
| trg\_discussion\_reply\_updated\_at | BEFORE UPDATE ON Discussion\_Reply | Auto-stamps updated\_at |

## **8.2 Stored Procedures**

| Procedure | Description |
| ----- | ----- |
| sp\_enroll\_student(student\_id, section\_id, semester\_id) | Validates capacity and duplicate enrollment, then inserts into Enrollment |
| sp\_submit\_teacher\_review(...) | Validates student-section relationship, then INSERT ... ON CONFLICT DO UPDATE for review |

## **8.3 Procedure Usage Example**

\-- Enroll a student (validates capacity \+ duplicate)  
CALL sp\_enroll\_student(1, 1, 3);  
   
\-- Submit teacher review  
CALL sp\_submit\_teacher\_review(  
  1,          \-- student\_id  
  1,          \-- instructor\_id  
  1,          \-- section\_id  
  3,          \-- semester\_id  
  5, 4, 5, 4, 5,  \-- ratings  
  'Excellent professor, very helpful\!',  
  TRUE        \-- anonymous  
);

# **9\. Index Recommendations**

| Index | Table.Column(s) | Justification |
| ----- | ----- | ----- |
| idx\_student\_program | Student(program\_id) | Frequent joins from Student to Program |
| idx\_enrollment\_student | Enrollment(student\_id) | Most queries filter by student |
| idx\_enrollment\_section | Enrollment(section\_id) | Section-based enrollment lookups |
| idx\_attendance\_enrollment | Attendance(enrollment\_id) | Attendance report queries |
| idx\_attendance\_date | Attendance(class\_date) | Date-range attendance queries |
| idx\_teacher\_review\_instructor | Teacher\_Review(instructor\_id) | Review lookup by instructor |
| idx\_section\_course | Section(course\_id) | Course-to-section lookups |
| idx\_section\_semester | Section(semester\_id) | Semester-filtered section queries |
| idx\_notice\_audience | Notice(audience) | Audience-filtered notice board |
| idx\_hall\_allocation\_student | Hall\_Allocation(student\_id) | Hall status per student |

# **10\. Unique Features for University Students**

Five distinctive features make this system especially valuable as a daily tool for university students, faculty, and staff:

## **Feature 1: Anonymous Teacher Review System**

Students can rate instructors on 5 dimensions: Teaching Quality, Communication, Punctuality, Fairness, and Helpfulness. Reviews are optionally anonymous and go through an approval workflow (Pending → Approved/Rejected). The overall\_rating is automatically calculated via a PostgreSQL GENERATED ALWAYS column. Aggregated results power the Teacher Dashboard view.

## **Feature 2: Google Classroom-Style LMS Module**

A full learning management system with Classroom\_Post (announcements, materials, questions), Course\_Material uploads with topic tagging, Assignment with late-submission policies and automatic percentage deduction, Assignment\_Submission with grading workflow, and Discussion\_Thread with threaded Discussion\_Reply (including self-referential parent\_reply\_id for nested replies and is\_solution marking).

## **Feature 3: Hall (Dormitory) Management**

The Hall table tracks dormitories with type (Male/Female/CoEd), capacity, and warden assignment. Hall\_Allocation manages per-student room and bed assignments with date ranges, enabling historical tracking and active allocation queries.

## **Feature 4: Transport Route & Subscription**

Transport\_Route defines bus/shuttle routes with origin, destination, stops, schedule, driver info, and capacity. Students subscribe via Transport\_Subscription with start/end dates. Enables route occupancy analysis and student transport billing.

## **Feature 5: Instructor Appointment Booking**

The Appointment table allows students to book meetings with instructors with purpose, scheduled time, duration, location or meet link, and status lifecycle (Scheduled → Completed/Cancelled/NoShow). Cancellation reason is captured for analytics.

# **11\. Conclusion**

This University ERP database design provides a comprehensive, production-ready PostgreSQL schema for managing all aspects of university operations:

* 35 tables across 5 modules covering Academic, LMS, Services, Campus, and Access Control

* 3NF normalization verified for all tables with documented functional dependencies

* Full constraint coverage: PK, FK with referential actions, UNIQUE, CHECK, NOT NULL, GENERATED

* 5 PostgreSQL triggers for automatic CGPA calculation, enrollment counts, and timestamps

* 2 stored procedures for transactional enrollment and review submission workflows

* 6 dashboard views serving students, faculty, and administrators

* Performance indexes on all high-traffic foreign keys and filter columns

* Seed data for immediate testing in a development environment

* 5 unique student-centric features: Teacher Reviews, LMS, Hall Management, Transport, Appointments

The schema is designed to scale from a single-faculty department to a full multi-faculty university. The RBAC module (Permission \+ Role\_Permission) supports future integration with application-layer authorization. All ON DELETE and ON UPDATE rules are carefully chosen to preserve data integrity while allowing legitimate deletions.

# **Appendix: Full PostgreSQL SQL File**

The complete DDL SQL code is provided as a separate file (university\_erp\_schema.sql) alongside this document. Copy the entire contents into your PostgreSQL client or run:

psql \-U postgres \-d university\_erp \-f university\_erp\_schema.sql

The SQL file contains: ENUMs, all 35 CREATE TABLE statements, all indexes, all triggers and functions, all views, both stored procedures, and seed data for immediate testing.