-- ============================================================
-- UNIVERSITY ERP DATABASE - Complete PostgreSQL DDL
-- Normalized to 3NF | 30 Tables | Full Constraints
-- ============================================================

-- ========================
-- EXTENSIONS
-- ========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================
-- ENUMS
-- ========================
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE day_of_week AS ENUM ('Sun','Mon','Tue','Wed','Thu','Fri','Sat');
CREATE TYPE enrollment_status AS ENUM ('Enrolled','Dropped','Completed','Waitlisted');
CREATE TYPE attendance_status AS ENUM ('Present','Absent','Late','Excused');
CREATE TYPE submission_status AS ENUM ('Submitted','Late','Not_Submitted','Graded');
CREATE TYPE post_type AS ENUM ('Announcement','Material','Assignment','Question');
CREATE TYPE review_status AS ENUM ('Approved','Pending','Rejected');
CREATE TYPE appointment_status AS ENUM ('Scheduled','Completed','Cancelled','NoShow');
CREATE TYPE transport_type AS ENUM ('Bus','Shuttle','Van');
CREATE TYPE hall_type AS ENUM ('Male','Female','CoEd');
CREATE TYPE event_type AS ENUM ('Academic','Cultural','Sports','Seminar','Workshop','Other');
CREATE TYPE notice_audience AS ENUM ('All','Students','Faculty','Staff','Admin');
CREATE TYPE role_type AS ENUM ('Admin','Faculty','Student','Staff');
CREATE TYPE staff_category AS ENUM ('Administrative','Technical','Support','Library','Finance');

-- ========================
-- MODULE 1: CAMPUS INFRASTRUCTURE
-- ========================

CREATE TABLE Building (
    building_id     SERIAL PRIMARY KEY,
    building_name   VARCHAR(100) NOT NULL UNIQUE,
    address         TEXT NOT NULL,
    total_floors    SMALLINT NOT NULL CHECK (total_floors BETWEEN 1 AND 50),
    built_year      SMALLINT CHECK (built_year BETWEEN 1800 AND 2100),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Classroom (
    room_id         SERIAL PRIMARY KEY,
    building_id     INT NOT NULL REFERENCES Building(building_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    room_number     VARCHAR(20) NOT NULL,
    floor_number    SMALLINT NOT NULL CHECK (floor_number >= 0),
    capacity        SMALLINT NOT NULL CHECK (capacity BETWEEN 1 AND 2000),
    room_type       VARCHAR(30) NOT NULL DEFAULT 'Lecture'
                        CHECK (room_type IN ('Lecture','Lab','Seminar','Exam Hall','Auditorium')),
    has_projector   BOOLEAN NOT NULL DEFAULT FALSE,
    has_ac          BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (building_id, room_number)
);

-- ========================
-- MODULE 2: ACADEMIC STRUCTURE
-- ========================

CREATE TABLE Department (
    dept_id         SERIAL PRIMARY KEY,
    dept_name       VARCHAR(100) NOT NULL UNIQUE,
    dept_code       VARCHAR(10) NOT NULL UNIQUE,
    description     TEXT,
    office_location VARCHAR(100),
    phone           VARCHAR(20),
    email           VARCHAR(100) UNIQUE CHECK (email LIKE '%@%'),
    established     DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Program (
    program_id      SERIAL PRIMARY KEY,
    dept_id         INT NOT NULL REFERENCES Department(dept_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    program_name    VARCHAR(150) NOT NULL,
    program_code    VARCHAR(20) NOT NULL UNIQUE,
    degree_level    VARCHAR(30) NOT NULL CHECK (degree_level IN ('Certificate','Diploma','Associate','Bachelor','Master','PhD')),
    duration_years  NUMERIC(3,1) NOT NULL CHECK (duration_years BETWEEN 0.5 AND 8),
    total_credits   SMALLINT NOT NULL CHECK (total_credits BETWEEN 1 AND 300),
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Semester (
    semester_id     SERIAL PRIMARY KEY,
    semester_name   VARCHAR(50) NOT NULL,
    year            SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    term            VARCHAR(20) NOT NULL CHECK (term IN ('Spring','Summer','Fall','Winter')),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    registration_open   DATE,
    registration_close  DATE,
    UNIQUE (year, term),
    CHECK (start_date < end_date),
    CHECK (registration_open IS NULL OR registration_open <= registration_close),
    CHECK (registration_close IS NULL OR registration_close <= start_date)
);

CREATE TABLE TimeSlot (
    slot_id         SERIAL PRIMARY KEY,
    slot_name       VARCHAR(30) NOT NULL UNIQUE,
    day_of_week     day_of_week NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    CHECK (start_time < end_time)
);

-- ========================
-- MODULE 3: USERS
-- ========================

CREATE TABLE Users (
    user_id         SERIAL PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(150) NOT NULL UNIQUE CHECK (email LIKE '%@%'),
    password_hash   VARCHAR(255) NOT NULL,
    role            role_type NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Instructor (
    instructor_id   SERIAL PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    dept_id         INT NOT NULL REFERENCES Department(dept_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    first_name      VARCHAR(60) NOT NULL,
    last_name       VARCHAR(60) NOT NULL,
    gender          gender_type,
    date_of_birth   DATE CHECK (date_of_birth < CURRENT_DATE),
    phone           VARCHAR(20),
    office_location VARCHAR(100),
    hire_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    employee_id     VARCHAR(30) NOT NULL UNIQUE,
    designation     VARCHAR(80) NOT NULL DEFAULT 'Lecturer'
                        CHECK (designation IN ('Lecturer','Assistant Professor','Associate Professor','Professor','Adjunct','Visiting')),
    specialization  VARCHAR(200),
    bio             TEXT,
    profile_photo   VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE Staff (
    staff_id        SERIAL PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    dept_id         INT REFERENCES Department(dept_id) ON DELETE SET NULL ON UPDATE CASCADE,
    first_name      VARCHAR(60) NOT NULL,
    last_name       VARCHAR(60) NOT NULL,
    gender          gender_type,
    date_of_birth   DATE CHECK (date_of_birth < CURRENT_DATE),
    phone           VARCHAR(20),
    hire_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    employee_id     VARCHAR(30) NOT NULL UNIQUE,
    category        staff_category NOT NULL DEFAULT 'Administrative',
    position_title  VARCHAR(100) NOT NULL,
    salary          NUMERIC(12,2) CHECK (salary >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE Student (
    student_id      SERIAL PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    program_id      INT NOT NULL REFERENCES Program(program_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    first_name      VARCHAR(60) NOT NULL,
    last_name       VARCHAR(60) NOT NULL,
    gender          gender_type,
    date_of_birth   DATE NOT NULL CHECK (date_of_birth < CURRENT_DATE),
    phone           VARCHAR(20),
    address         TEXT,
    student_roll    VARCHAR(30) NOT NULL UNIQUE,
    admission_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    batch_year      SMALLINT NOT NULL CHECK (batch_year BETWEEN 2000 AND 2100),
    current_semester SMALLINT NOT NULL DEFAULT 1 CHECK (current_semester BETWEEN 1 AND 20),
    cgpa            NUMERIC(4,2) DEFAULT 0.00 CHECK (cgpa BETWEEN 0 AND 4.00),
    total_credits   SMALLINT NOT NULL DEFAULT 0 CHECK (total_credits >= 0),
    profile_photo   VARCHAR(255),
    emergency_contact_name  VARCHAR(120),
    emergency_contact_phone VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ========================
-- MODULE 4: COURSES
-- ========================

CREATE TABLE Course (
    course_id       SERIAL PRIMARY KEY,
    dept_id         INT NOT NULL REFERENCES Department(dept_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    course_code     VARCHAR(20) NOT NULL UNIQUE,
    course_name     VARCHAR(200) NOT NULL,
    description     TEXT,
    credit_hours    NUMERIC(3,1) NOT NULL CHECK (credit_hours BETWEEN 0.5 AND 6),
    theory_hours    NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (theory_hours >= 0),
    lab_hours       NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (lab_hours >= 0),
    level           VARCHAR(20) NOT NULL DEFAULT 'Undergraduate'
                        CHECK (level IN ('Undergraduate','Graduate','Postgraduate')),
    is_elective     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Course_Prerequisite (
    course_id       INT NOT NULL REFERENCES Course(course_id) ON DELETE CASCADE ON UPDATE CASCADE,
    prereq_id       INT NOT NULL REFERENCES Course(course_id) ON DELETE CASCADE ON UPDATE CASCADE,
    min_grade       VARCHAR(5) NOT NULL DEFAULT 'D',
    PRIMARY KEY (course_id, prereq_id),
    CHECK (course_id <> prereq_id)
);

CREATE TABLE Section (
    section_id      SERIAL PRIMARY KEY,
    course_id       INT NOT NULL REFERENCES Course(course_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    semester_id     INT NOT NULL REFERENCES Semester(semester_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    instructor_id   INT NOT NULL REFERENCES Instructor(instructor_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    room_id         INT REFERENCES Classroom(room_id) ON DELETE SET NULL ON UPDATE CASCADE,
    section_number  VARCHAR(10) NOT NULL DEFAULT 'A',
    max_capacity    SMALLINT NOT NULL DEFAULT 40 CHECK (max_capacity BETWEEN 1 AND 500),
    enrolled_count  SMALLINT NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
    is_online       BOOLEAN NOT NULL DEFAULT FALSE,
    syllabus_url    VARCHAR(255),
    meet_link       VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (course_id, semester_id, section_number),
    CHECK (enrolled_count <= max_capacity)
);

CREATE TABLE Section_Schedule (
    schedule_id     SERIAL PRIMARY KEY,
    section_id      INT NOT NULL REFERENCES Section(section_id) ON DELETE CASCADE ON UPDATE CASCADE,
    slot_id         INT NOT NULL REFERENCES TimeSlot(slot_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    room_id         INT REFERENCES Classroom(room_id) ON DELETE SET NULL ON UPDATE CASCADE,
    UNIQUE (section_id, slot_id)
);

-- ========================
-- MODULE 5: ENROLLMENT & ACADEMIC RECORD
-- ========================

CREATE TABLE Enrollment (
    enrollment_id   SERIAL PRIMARY KEY,
    student_id      INT NOT NULL REFERENCES Student(student_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    section_id      INT NOT NULL REFERENCES Section(section_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    semester_id     INT NOT NULL REFERENCES Semester(semester_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          enrollment_status NOT NULL DEFAULT 'Enrolled',
    grade           VARCHAR(5),
    grade_points    NUMERIC(3,2) CHECK (grade_points BETWEEN 0 AND 4),
    UNIQUE (student_id, section_id),
    CHECK (grade IS NULL OR grade IN ('A+','A','A-','B+','B','B-','C+','C','C-','D+','D','F','W','I'))
);

CREATE TABLE Attendance (
    attendance_id   SERIAL PRIMARY KEY,
    enrollment_id   INT NOT NULL REFERENCES Enrollment(enrollment_id) ON DELETE CASCADE ON UPDATE CASCADE,
    class_date      DATE NOT NULL,
    status          attendance_status NOT NULL DEFAULT 'Present',
    remarks         VARCHAR(200),
    recorded_by     INT REFERENCES Instructor(instructor_id) ON DELETE SET NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (enrollment_id, class_date)
);

CREATE TABLE Assessment (
    assessment_id   SERIAL PRIMARY KEY,
    section_id      INT NOT NULL REFERENCES Section(section_id) ON DELETE CASCADE ON UPDATE CASCADE,
    title           VARCHAR(200) NOT NULL,
    type            VARCHAR(30) NOT NULL
                        CHECK (type IN ('Quiz','Midterm','Final','Assignment','Project','Lab','Presentation','Viva')),
    total_marks     NUMERIC(6,2) NOT NULL CHECK (total_marks > 0),
    weightage       NUMERIC(5,2) NOT NULL CHECK (weightage BETWEEN 0 AND 100),
    scheduled_date  DATE,
    due_date        TIMESTAMPTZ,
    description     TEXT,
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Assessment_Result (
    result_id       SERIAL PRIMARY KEY,
    assessment_id   INT NOT NULL REFERENCES Assessment(assessment_id) ON DELETE CASCADE ON UPDATE CASCADE,
    enrollment_id   INT NOT NULL REFERENCES Enrollment(enrollment_id) ON DELETE CASCADE ON UPDATE CASCADE,
    marks_obtained  NUMERIC(6,2) CHECK (marks_obtained >= 0),
    feedback        TEXT,
    graded_by       INT REFERENCES Instructor(instructor_id) ON DELETE SET NULL,
    graded_at       TIMESTAMPTZ,
    UNIQUE (assessment_id, enrollment_id)
);

CREATE TABLE Student_Advisor (
    advisor_id      SERIAL PRIMARY KEY,
    student_id      INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    instructor_id   INT NOT NULL REFERENCES Instructor(instructor_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    semester_id     INT NOT NULL REFERENCES Semester(semester_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    assigned_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    UNIQUE (student_id, semester_id)
);

-- ========================
-- MODULE 6: GOOGLE CLASSROOM STYLE
-- ========================

CREATE TABLE Classroom_Post (
    post_id         SERIAL PRIMARY KEY,
    section_id      INT NOT NULL REFERENCES Section(section_id) ON DELETE CASCADE ON UPDATE CASCADE,
    posted_by       INT NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    post_type       post_type NOT NULL DEFAULT 'Announcement',
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    allow_comments  BOOLEAN NOT NULL DEFAULT TRUE,
    scheduled_at    TIMESTAMPTZ,
    published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Course_Material (
    material_id     SERIAL PRIMARY KEY,
    section_id      INT NOT NULL REFERENCES Section(section_id) ON DELETE CASCADE ON UPDATE CASCADE,
    post_id         INT REFERENCES Classroom_Post(post_id) ON DELETE SET NULL ON UPDATE CASCADE,
    uploaded_by     INT NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    file_url        VARCHAR(500) NOT NULL,
    file_type       VARCHAR(30),
    file_size_kb    INT CHECK (file_size_kb > 0),
    topic           VARCHAR(100),
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Assignment (
    assignment_id   SERIAL PRIMARY KEY,
    section_id      INT NOT NULL REFERENCES Section(section_id) ON DELETE CASCADE ON UPDATE CASCADE,
    assessment_id   INT REFERENCES Assessment(assessment_id) ON DELETE SET NULL ON UPDATE CASCADE,
    post_id         INT REFERENCES Classroom_Post(post_id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_by      INT NOT NULL REFERENCES Instructor(instructor_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    instructions    TEXT,
    due_date        TIMESTAMPTZ NOT NULL,
    max_marks       NUMERIC(6,2) NOT NULL CHECK (max_marks > 0),
    allow_late      BOOLEAN NOT NULL DEFAULT FALSE,
    late_penalty_pct NUMERIC(5,2) DEFAULT 0 CHECK (late_penalty_pct BETWEEN 0 AND 100),
    attachment_url  VARCHAR(500),
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Assignment_Submission (
    submission_id   SERIAL PRIMARY KEY,
    assignment_id   INT NOT NULL REFERENCES Assignment(assignment_id) ON DELETE CASCADE ON UPDATE CASCADE,
    student_id      INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submission_url  VARCHAR(500),
    submission_text TEXT,
    status          submission_status NOT NULL DEFAULT 'Submitted',
    marks_obtained  NUMERIC(6,2) CHECK (marks_obtained >= 0),
    feedback        TEXT,
    graded_at       TIMESTAMPTZ,
    graded_by       INT REFERENCES Instructor(instructor_id) ON DELETE SET NULL,
    UNIQUE (assignment_id, student_id)
);

CREATE TABLE Discussion_Thread (
    thread_id       SERIAL PRIMARY KEY,
    section_id      INT NOT NULL REFERENCES Section(section_id) ON DELETE CASCADE ON UPDATE CASCADE,
    post_id         INT REFERENCES Classroom_Post(post_id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_by      INT NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    title           VARCHAR(255) NOT NULL,
    body            TEXT NOT NULL,
    is_closed       BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    views           INT NOT NULL DEFAULT 0 CHECK (views >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE Discussion_Reply (
    reply_id        SERIAL PRIMARY KEY,
    thread_id       INT NOT NULL REFERENCES Discussion_Thread(thread_id) ON DELETE CASCADE ON UPDATE CASCADE,
    replied_by      INT NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    parent_reply_id INT REFERENCES Discussion_Reply(reply_id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    is_solution     BOOLEAN NOT NULL DEFAULT FALSE,
    upvotes         INT NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- MODULE 7: UNIVERSITY SERVICES
-- ========================

CREATE TABLE Notice (
    notice_id       SERIAL PRIMARY KEY,
    posted_by       INT NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    dept_id         INT REFERENCES Department(dept_id) ON DELETE SET NULL ON UPDATE CASCADE,
    title           VARCHAR(255) NOT NULL,
    body            TEXT NOT NULL,
    audience        notice_audience NOT NULL DEFAULT 'All',
    priority        SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    publish_date    TIMESTAMPTZ,
    expiry_date     TIMESTAMPTZ,
    attachment_url  VARCHAR(500),
    views           INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (expiry_date IS NULL OR publish_date IS NULL OR expiry_date > publish_date)
);

CREATE TABLE Event (
    event_id        SERIAL PRIMARY KEY,
    organized_by    INT NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    dept_id         INT REFERENCES Department(dept_id) ON DELETE SET NULL ON UPDATE CASCADE,
    room_id         INT REFERENCES Classroom(room_id) ON DELETE SET NULL ON UPDATE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    event_type      event_type NOT NULL DEFAULT 'Academic',
    start_datetime  TIMESTAMPTZ NOT NULL,
    end_datetime    TIMESTAMPTZ NOT NULL,
    venue           VARCHAR(200),
    max_participants INT CHECK (max_participants > 0),
    registration_required BOOLEAN NOT NULL DEFAULT FALSE,
    registration_deadline TIMESTAMPTZ,
    is_public       BOOLEAN NOT NULL DEFAULT TRUE,
    banner_url      VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (start_datetime < end_datetime),
    CHECK (registration_deadline IS NULL OR registration_deadline <= start_datetime)
);

CREATE TABLE Event_Registration (
    reg_id          SERIAL PRIMARY KEY,
    event_id        INT NOT NULL REFERENCES Event(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id         INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attended        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (event_id, user_id)
);

CREATE TABLE Appointment (
    appointment_id  SERIAL PRIMARY KEY,
    student_id      INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    instructor_id   INT NOT NULL REFERENCES Instructor(instructor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_datetime TIMESTAMPTZ NOT NULL,
    duration_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 240),
    purpose         VARCHAR(300) NOT NULL,
    notes           TEXT,
    status          appointment_status NOT NULL DEFAULT 'Scheduled',
    location        VARCHAR(150),
    meet_link       VARCHAR(255),
    cancelled_reason TEXT
);

CREATE TABLE Teacher_Review (
    review_id       SERIAL PRIMARY KEY,
    instructor_id   INT NOT NULL REFERENCES Instructor(instructor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    student_id      INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    section_id      INT NOT NULL REFERENCES Section(section_id) ON DELETE CASCADE ON UPDATE CASCADE,
    semester_id     INT NOT NULL REFERENCES Semester(semester_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    rating_teaching     SMALLINT NOT NULL CHECK (rating_teaching BETWEEN 1 AND 5),
    rating_communication SMALLINT NOT NULL CHECK (rating_communication BETWEEN 1 AND 5),
    rating_punctuality  SMALLINT NOT NULL CHECK (rating_punctuality BETWEEN 1 AND 5),
    rating_fairness     SMALLINT NOT NULL CHECK (rating_fairness BETWEEN 1 AND 5),
    rating_helpfulness  SMALLINT NOT NULL CHECK (rating_helpfulness BETWEEN 1 AND 5),
    overall_rating  NUMERIC(3,2) GENERATED ALWAYS AS (
        (rating_teaching + rating_communication + rating_punctuality + rating_fairness + rating_helpfulness)::NUMERIC / 5
    ) STORED,
    written_review  TEXT,
    is_anonymous    BOOLEAN NOT NULL DEFAULT TRUE,
    status          review_status NOT NULL DEFAULT 'Pending',
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, section_id, semester_id)
);

-- ========================
-- MODULE 8: CAMPUS FACILITIES
-- ========================

CREATE TABLE Hall (
    hall_id         SERIAL PRIMARY KEY,
    building_id     INT REFERENCES Building(building_id) ON DELETE SET NULL ON UPDATE CASCADE,
    hall_name       VARCHAR(100) NOT NULL UNIQUE,
    hall_type       hall_type NOT NULL DEFAULT 'CoEd',
    total_rooms     SMALLINT NOT NULL CHECK (total_rooms > 0),
    total_capacity  SMALLINT NOT NULL CHECK (total_capacity > 0),
    warden_staff_id INT REFERENCES Staff(staff_id) ON DELETE SET NULL ON UPDATE CASCADE,
    facilities      TEXT,
    monthly_fee     NUMERIC(10,2) CHECK (monthly_fee >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE Hall_Allocation (
    allocation_id   SERIAL PRIMARY KEY,
    hall_id         INT NOT NULL REFERENCES Hall(hall_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    student_id      INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    room_number     VARCHAR(20) NOT NULL,
    bed_number      SMALLINT CHECK (bed_number > 0),
    allocated_from  DATE NOT NULL,
    allocated_to    DATE,
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    monthly_fee     NUMERIC(10,2) CHECK (monthly_fee >= 0),
    CHECK (allocated_to IS NULL OR allocated_to > allocated_from)
);

CREATE TABLE Transport_Route (
    route_id        SERIAL PRIMARY KEY,
    route_name      VARCHAR(100) NOT NULL UNIQUE,
    route_code      VARCHAR(20) NOT NULL UNIQUE,
    origin          VARCHAR(150) NOT NULL,
    destination     VARCHAR(150) NOT NULL,
    stops           TEXT,
    departure_time  TIME NOT NULL,
    arrival_time    TIME NOT NULL,
    transport_type  transport_type NOT NULL DEFAULT 'Bus',
    vehicle_number  VARCHAR(30),
    driver_name     VARCHAR(100),
    driver_phone    VARCHAR(20),
    capacity        SMALLINT NOT NULL CHECK (capacity > 0),
    monthly_fee     NUMERIC(10,2) CHECK (monthly_fee >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (departure_time < arrival_time)
);

CREATE TABLE Transport_Subscription (
    sub_id          SERIAL PRIMARY KEY,
    route_id        INT NOT NULL REFERENCES Transport_Route(route_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    student_id      INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    start_date      DATE NOT NULL,
    end_date        DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    monthly_fee_paid NUMERIC(10,2) CHECK (monthly_fee_paid >= 0),
    UNIQUE (route_id, student_id),
    CHECK (end_date IS NULL OR end_date > start_date)
);

-- ========================
-- MODULE 9: ROLE-BASED ACCESS CONTROL
-- ========================

CREATE TABLE Permission (
    perm_id         SERIAL PRIMARY KEY,
    perm_name       VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    module          VARCHAR(50) NOT NULL
);

CREATE TABLE Role_Permission (
    role            role_type NOT NULL,
    perm_id         INT NOT NULL REFERENCES Permission(perm_id) ON DELETE CASCADE ON UPDATE CASCADE,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role, perm_id)
);

-- ========================
-- INDEXES FOR PERFORMANCE
-- ========================

CREATE INDEX idx_student_program ON Student(program_id);
CREATE INDEX idx_student_user ON Student(user_id);
CREATE INDEX idx_instructor_dept ON Instructor(dept_id);
CREATE INDEX idx_section_course ON Section(course_id);
CREATE INDEX idx_section_semester ON Section(semester_id);
CREATE INDEX idx_enrollment_student ON Enrollment(student_id);
CREATE INDEX idx_enrollment_section ON Enrollment(section_id);
CREATE INDEX idx_attendance_enrollment ON Attendance(enrollment_id);
CREATE INDEX idx_attendance_date ON Attendance(class_date);
CREATE INDEX idx_assessment_result_enrollment ON Assessment_Result(enrollment_id);
CREATE INDEX idx_classroom_post_section ON Classroom_Post(section_id);
CREATE INDEX idx_notice_audience ON Notice(audience);
CREATE INDEX idx_teacher_review_instructor ON Teacher_Review(instructor_id);
CREATE INDEX idx_teacher_review_semester ON Teacher_Review(semester_id);
CREATE INDEX idx_hall_allocation_student ON Hall_Allocation(student_id);
CREATE INDEX idx_transport_sub_student ON Transport_Subscription(student_id);

-- ========================
-- TRIGGER: Auto-update CGPA after grading
-- ========================

CREATE OR REPLACE FUNCTION update_student_cgpa()
RETURNS TRIGGER AS $$
DECLARE
    v_student_id INT;
    v_total_weighted NUMERIC := 0;
    v_total_credits NUMERIC := 0;
    v_new_cgpa NUMERIC(4,2);
BEGIN
    SELECT student_id INTO v_student_id
    FROM Enrollment WHERE enrollment_id = NEW.enrollment_id;

    SELECT
        COALESCE(SUM(e.grade_points * c.credit_hours), 0),
        COALESCE(SUM(CASE WHEN e.grade_points IS NOT NULL THEN c.credit_hours ELSE 0 END), 0)
    INTO v_total_weighted, v_total_credits
    FROM Enrollment e
    JOIN Section s ON s.section_id = e.section_id
    JOIN Course c ON c.course_id = s.course_id
    WHERE e.student_id = v_student_id
      AND e.status = 'Completed'
      AND e.grade_points IS NOT NULL;

    IF v_total_credits > 0 THEN
        v_new_cgpa := ROUND(v_total_weighted / v_total_credits, 2);
    ELSE
        v_new_cgpa := 0.00;
    END IF;

    UPDATE Student
    SET cgpa = v_new_cgpa,
        total_credits = v_total_credits::SMALLINT
    WHERE student_id = v_student_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_cgpa
AFTER INSERT OR UPDATE OF grade_points ON Enrollment
FOR EACH ROW
WHEN (NEW.grade_points IS NOT NULL)
EXECUTE FUNCTION update_student_cgpa();

-- ========================
-- TRIGGER: Update section enrolled_count
-- ========================

CREATE OR REPLACE FUNCTION update_enrolled_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'Enrolled' THEN
        UPDATE Section SET enrolled_count = enrolled_count + 1
        WHERE section_id = NEW.section_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status <> 'Enrolled' AND NEW.status = 'Enrolled' THEN
            UPDATE Section SET enrolled_count = enrolled_count + 1
            WHERE section_id = NEW.section_id;
        ELSIF OLD.status = 'Enrolled' AND NEW.status <> 'Enrolled' THEN
            UPDATE Section SET enrolled_count = GREATEST(enrolled_count - 1, 0)
            WHERE section_id = NEW.section_id;
        END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'Enrolled' THEN
        UPDATE Section SET enrolled_count = GREATEST(enrolled_count - 1, 0)
        WHERE section_id = OLD.section_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enrolled_count
AFTER INSERT OR UPDATE OF status OR DELETE ON Enrollment
FOR EACH ROW
EXECUTE FUNCTION update_enrolled_count();

-- ========================
-- TRIGGER: Update updated_at timestamps
-- ========================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON Users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_discussion_thread_updated_at
BEFORE UPDATE ON Discussion_Thread
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_discussion_reply_updated_at
BEFORE UPDATE ON Discussion_Reply
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================
-- VIEWS
-- ========================

-- Student Dashboard View
CREATE VIEW v_student_dashboard AS
SELECT
    s.student_id,
    s.student_roll,
    s.first_name || ' ' || s.last_name AS full_name,
    p.program_name,
    p.degree_level,
    d.dept_name,
    s.current_semester,
    s.cgpa,
    s.total_credits,
    COUNT(DISTINCT e.enrollment_id) FILTER (WHERE e.status = 'Enrolled') AS active_courses,
    COUNT(DISTINCT ha.allocation_id) FILTER (WHERE ha.is_current = TRUE) AS has_hall
FROM Student s
JOIN Program p ON p.program_id = s.program_id
JOIN Department d ON d.dept_id = p.dept_id
LEFT JOIN Enrollment e ON e.student_id = s.student_id
LEFT JOIN Hall_Allocation ha ON ha.student_id = s.student_id
WHERE s.is_active = TRUE
GROUP BY s.student_id, s.student_roll, s.first_name, s.last_name,
         p.program_name, p.degree_level, d.dept_name, s.current_semester,
         s.cgpa, s.total_credits;

-- Teacher Dashboard View
CREATE VIEW v_teacher_dashboard AS
SELECT
    i.instructor_id,
    i.employee_id,
    i.first_name || ' ' || i.last_name AS full_name,
    i.designation,
    d.dept_name,
    COUNT(DISTINCT s.section_id) AS current_sections,
    COUNT(DISTINCT e.student_id) AS total_students,
    ROUND(AVG(tr.overall_rating), 2) AS avg_review_rating,
    COUNT(DISTINCT tr.review_id) AS total_reviews
FROM Instructor i
JOIN Department d ON d.dept_id = i.dept_id
LEFT JOIN Section s ON s.instructor_id = i.instructor_id
    AND s.semester_id IN (SELECT semester_id FROM Semester WHERE is_current = TRUE)
LEFT JOIN Enrollment e ON e.section_id = s.section_id AND e.status = 'Enrolled'
LEFT JOIN Teacher_Review tr ON tr.instructor_id = i.instructor_id
    AND tr.status = 'Approved'
WHERE i.is_active = TRUE
GROUP BY i.instructor_id, i.employee_id, i.first_name, i.last_name,
         i.designation, d.dept_name;

-- Admin Dashboard View
CREATE VIEW v_admin_dashboard AS
SELECT
    (SELECT COUNT(*) FROM Student WHERE is_active = TRUE) AS total_students,
    (SELECT COUNT(*) FROM Instructor WHERE is_active = TRUE) AS total_instructors,
    (SELECT COUNT(*) FROM Staff WHERE is_active = TRUE) AS total_staff,
    (SELECT COUNT(*) FROM Department WHERE is_active = TRUE) AS total_departments,
    (SELECT COUNT(*) FROM Program WHERE is_active = TRUE) AS total_programs,
    (SELECT COUNT(*) FROM Section s JOIN Semester sem ON sem.semester_id = s.semester_id WHERE sem.is_current = TRUE AND s.is_active = TRUE) AS current_sections,
    (SELECT COUNT(*) FROM Enrollment WHERE status = 'Enrolled') AS active_enrollments,
    (SELECT ROUND(AVG(overall_rating), 2) FROM Teacher_Review WHERE status = 'Approved') AS avg_teacher_rating,
    (SELECT COUNT(*) FROM Notice WHERE is_published = TRUE AND (expiry_date IS NULL OR expiry_date > NOW())) AS active_notices,
    (SELECT COUNT(*) FROM Event WHERE start_datetime > NOW()) AS upcoming_events;

-- Attendance Summary View
CREATE VIEW v_attendance_summary AS
SELECT
    e.enrollment_id,
    e.student_id,
    s.first_name || ' ' || s.last_name AS student_name,
    s.student_roll,
    sec.section_id,
    c.course_code,
    c.course_name,
    COUNT(a.attendance_id) AS total_classes,
    COUNT(a.attendance_id) FILTER (WHERE a.status = 'Present') AS present_count,
    COUNT(a.attendance_id) FILTER (WHERE a.status = 'Absent') AS absent_count,
    COUNT(a.attendance_id) FILTER (WHERE a.status = 'Late') AS late_count,
    CASE
        WHEN COUNT(a.attendance_id) = 0 THEN 0
        ELSE ROUND(100.0 * COUNT(a.attendance_id) FILTER (WHERE a.status IN ('Present','Late'))
             / COUNT(a.attendance_id), 2)
    END AS attendance_pct
FROM Enrollment e
JOIN Student s ON s.student_id = e.student_id
JOIN Section sec ON sec.section_id = e.section_id
JOIN Course c ON c.course_id = sec.course_id
LEFT JOIN Attendance a ON a.enrollment_id = e.enrollment_id
GROUP BY e.enrollment_id, e.student_id, s.first_name, s.last_name,
         s.student_roll, sec.section_id, c.course_code, c.course_name;

-- Course Results View
CREATE VIEW v_course_results AS
SELECT
    e.student_id,
    s.student_roll,
    s.first_name || ' ' || s.last_name AS student_name,
    c.course_code,
    c.course_name,
    c.credit_hours,
    sem.semester_name,
    sem.year,
    e.grade,
    e.grade_points,
    e.status AS enrollment_status
FROM Enrollment e
JOIN Student s ON s.student_id = e.student_id
JOIN Section sec ON sec.section_id = e.section_id
JOIN Course c ON c.course_id = sec.course_id
JOIN Semester sem ON sem.semester_id = e.semester_id
ORDER BY s.student_roll, sem.year, sem.term;

-- Teacher Review Summary
CREATE VIEW v_teacher_review_summary AS
SELECT
    i.instructor_id,
    i.first_name || ' ' || i.last_name AS instructor_name,
    i.designation,
    d.dept_name,
    sem.semester_name,
    sem.year,
    COUNT(tr.review_id) AS review_count,
    ROUND(AVG(tr.rating_teaching), 2) AS avg_teaching,
    ROUND(AVG(tr.rating_communication), 2) AS avg_communication,
    ROUND(AVG(tr.rating_punctuality), 2) AS avg_punctuality,
    ROUND(AVG(tr.rating_fairness), 2) AS avg_fairness,
    ROUND(AVG(tr.rating_helpfulness), 2) AS avg_helpfulness,
    ROUND(AVG(tr.overall_rating), 2) AS avg_overall
FROM Teacher_Review tr
JOIN Instructor i ON i.instructor_id = tr.instructor_id
JOIN Department d ON d.dept_id = i.dept_id
JOIN Semester sem ON sem.semester_id = tr.semester_id
WHERE tr.status = 'Approved'
GROUP BY i.instructor_id, i.first_name, i.last_name, i.designation,
         d.dept_name, sem.semester_name, sem.year;

-- ========================
-- STORED PROCEDURE: Register Student in Section
-- ========================

CREATE OR REPLACE PROCEDURE sp_enroll_student(
    p_student_id INT,
    p_section_id INT,
    p_semester_id INT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_cap INT;
    v_enrolled INT;
    v_already INT;
BEGIN
    SELECT max_capacity, enrolled_count INTO v_cap, v_enrolled
    FROM Section WHERE section_id = p_section_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Section % not found', p_section_id;
    END IF;

    IF v_enrolled >= v_cap THEN
        RAISE EXCEPTION 'Section % is full (% / %)', p_section_id, v_enrolled, v_cap;
    END IF;

    SELECT COUNT(*) INTO v_already
    FROM Enrollment
    WHERE student_id = p_student_id AND section_id = p_section_id;

    IF v_already > 0 THEN
        RAISE EXCEPTION 'Student % already enrolled in section %', p_student_id, p_section_id;
    END IF;

    INSERT INTO Enrollment (student_id, section_id, semester_id, status)
    VALUES (p_student_id, p_section_id, p_semester_id, 'Enrolled');

    RAISE NOTICE 'Student % enrolled in section % successfully', p_student_id, p_section_id;
END;
$$;

-- ========================
-- STORED PROCEDURE: Submit Teacher Review
-- ========================

CREATE OR REPLACE PROCEDURE sp_submit_teacher_review(
    p_student_id INT,
    p_instructor_id INT,
    p_section_id INT,
    p_semester_id INT,
    p_r_teaching SMALLINT,
    p_r_comm SMALLINT,
    p_r_punct SMALLINT,
    p_r_fair SMALLINT,
    p_r_help SMALLINT,
    p_review TEXT DEFAULT NULL,
    p_anon BOOLEAN DEFAULT TRUE
)
LANGUAGE plpgsql AS $$
DECLARE
    v_enrolled INT;
BEGIN
    SELECT COUNT(*) INTO v_enrolled
    FROM Enrollment e
    WHERE e.student_id = p_student_id
      AND e.section_id = p_section_id;

    IF v_enrolled = 0 THEN
        RAISE EXCEPTION 'Student % was not enrolled in section %', p_student_id, p_section_id;
    END IF;

    INSERT INTO Teacher_Review (
        instructor_id, student_id, section_id, semester_id,
        rating_teaching, rating_communication, rating_punctuality,
        rating_fairness, rating_helpfulness,
        written_review, is_anonymous, status
    ) VALUES (
        p_instructor_id, p_student_id, p_section_id, p_semester_id,
        p_r_teaching, p_r_comm, p_r_punct, p_r_fair, p_r_help,
        p_review, p_anon, 'Pending'
    )
    ON CONFLICT (student_id, section_id, semester_id) DO UPDATE
        SET rating_teaching = EXCLUDED.rating_teaching,
            rating_communication = EXCLUDED.rating_communication,
            rating_punctuality = EXCLUDED.rating_punctuality,
            rating_fairness = EXCLUDED.rating_fairness,
            rating_helpfulness = EXCLUDED.rating_helpfulness,
            written_review = EXCLUDED.written_review,
            submitted_at = NOW(),
            status = 'Pending';

    RAISE NOTICE 'Review submitted for instructor % by student %', p_instructor_id, p_student_id;
END;
$$;

-- ========================
-- SAMPLE DATA (Minimal seed)
-- ========================

-- Buildings
INSERT INTO Building (building_name, address, total_floors) VALUES
('Academic Block A', '1 University Road', 5),
('Science Block', '2 University Road', 4),
('Administration Block', '3 University Road', 3),
('Library Building', '4 University Road', 2),
('Student Hall 1', '5 University Road', 7);

-- Departments
INSERT INTO Department (dept_name, dept_code, email, established) VALUES
('Computer Science & Engineering', 'CSE', 'cse@university.edu', '1990-01-01'),
('Electrical Engineering', 'EEE', 'eee@university.edu', '1985-01-01'),
('Business Administration', 'BBA', 'bba@university.edu', '1995-01-01'),
('Mathematics', 'MATH', 'math@university.edu', '1980-01-01'),
('Physics', 'PHY', 'phy@university.edu', '1980-01-01');

-- Programs
INSERT INTO Program (dept_id, program_name, program_code, degree_level, duration_years, total_credits) VALUES
(1, 'Bachelor of Science in Computer Science', 'BSC-CS', 'Bachelor', 4, 136),
(1, 'Master of Science in Computer Science', 'MSC-CS', 'Master', 2, 72),
(2, 'Bachelor of Science in Electrical Engineering', 'BSC-EEE', 'Bachelor', 4, 140),
(3, 'Bachelor of Business Administration', 'BBA', 'Bachelor', 4, 120),
(4, 'Bachelor of Science in Mathematics', 'BSC-MATH', 'Bachelor', 3, 100);

-- Semester
INSERT INTO Semester (semester_name, year, term, start_date, end_date, is_current) VALUES
('Spring 2025', 2025, 'Spring', '2025-01-15', '2025-05-31', FALSE),
('Fall 2025', 2025, 'Fall', '2025-08-01', '2025-12-15', FALSE),
('Spring 2026', 2026, 'Spring', '2026-01-20', '2026-05-30', TRUE);

-- TimeSlots
INSERT INTO TimeSlot (slot_name, day_of_week, start_time, end_time) VALUES
('Mon 8-9', 'Mon', '08:00', '09:30'),
('Mon 10-11', 'Mon', '10:00', '11:30'),
('Tue 8-9', 'Tue', '08:00', '09:30'),
('Wed 10-11', 'Wed', '10:00', '11:30'),
('Thu 2-3', 'Thu', '14:00', '15:30');

-- Classrooms
INSERT INTO Classroom (building_id, room_number, floor_number, capacity, room_type) VALUES
(1, '101', 1, 60, 'Lecture'),
(1, '102', 1, 40, 'Seminar'),
(2, '201', 2, 30, 'Lab'),
(1, '301', 3, 100, 'Exam Hall');

-- Users
INSERT INTO Users (username, email, password_hash, role) VALUES
('admin1', 'admin@university.edu', crypt('admin123', gen_salt('bf')), 'Admin'),
('prof_rahman', 'rahman@university.edu', crypt('pass123', gen_salt('bf')), 'Faculty'),
('prof_karim', 'karim@university.edu', crypt('pass123', gen_salt('bf')), 'Faculty'),
('staff_alice', 'alice@university.edu', crypt('pass123', gen_salt('bf')), 'Staff'),
('stu_2021001', 'stu2021001@university.edu', crypt('pass123', gen_salt('bf')), 'Student'),
('stu_2021002', 'stu2021002@university.edu', crypt('pass123', gen_salt('bf')), 'Student'),
('stu_2021003', 'stu2021003@university.edu', crypt('pass123', gen_salt('bf')), 'Student');

-- Instructors
INSERT INTO Instructor (user_id, dept_id, first_name, last_name, gender, employee_id, designation) VALUES
(2, 1, 'Mohammad', 'Rahman', 'Male', 'EMP-001', 'Associate Professor'),
(3, 1, 'Nasrin', 'Karim', 'Female', 'EMP-002', 'Assistant Professor');

-- Staff
INSERT INTO Staff (user_id, dept_id, first_name, last_name, gender, employee_id, category, position_title) VALUES
(4, 1, 'Alice', 'Johnson', 'Female', 'STF-001', 'Administrative', 'Department Coordinator');

-- Students
INSERT INTO Student (user_id, program_id, first_name, last_name, gender, date_of_birth, student_roll, batch_year, current_semester) VALUES
(5, 1, 'Rahim', 'Uddin', 'Male', '2002-03-15', '2021-CSE-001', 2021, 5),
(6, 1, 'Fatima', 'Begum', 'Female', '2002-07-22', '2021-CSE-002', 2021, 5),
(7, 1, 'Tanvir', 'Ahmed', 'Male', '2001-11-30', '2021-CSE-003', 2021, 5);

-- Courses
INSERT INTO Course (dept_id, course_code, course_name, credit_hours, theory_hours, lab_hours, level) VALUES
(1, 'CSE101', 'Introduction to Programming', 3, 2, 1, 'Undergraduate'),
(1, 'CSE201', 'Data Structures', 3, 2, 1, 'Undergraduate'),
(1, 'CSE301', 'Database Management Systems', 3, 2, 1, 'Undergraduate'),
(1, 'CSE401', 'Software Engineering', 3, 3, 0, 'Undergraduate'),
(4, 'MATH101', 'Calculus I', 3, 3, 0, 'Undergraduate');

-- Sections
INSERT INTO Section (course_id, semester_id, instructor_id, room_id, section_number, max_capacity) VALUES
(3, 3, 1, 1, 'A', 50),
(3, 3, 2, 2, 'B', 40),
(1, 3, 1, 1, 'A', 60);

-- Enrollments
INSERT INTO Enrollment (student_id, section_id, semester_id, status) VALUES
(1, 1, 3, 'Enrolled'),
(2, 1, 3, 'Enrolled'),
(3, 2, 3, 'Enrolled');

-- Hall
INSERT INTO Hall (building_id, hall_name, hall_type, total_rooms, total_capacity, monthly_fee) VALUES
(5, 'Bangabandhu Hall', 'Male', 100, 300, 3000.00),
(5, 'Begum Rokeya Hall', 'Female', 80, 200, 3000.00);

-- Transport
INSERT INTO Transport_Route (route_name, route_code, origin, destination, stops, departure_time, arrival_time, capacity, monthly_fee) VALUES
('City Route 1', 'RT-01', 'Main Gate', 'City Center', 'Market, Hospital, Bus Stand', '08:00', '09:00', 40, 1500.00),
('City Route 2', 'RT-02', 'Main Gate', 'North City', 'Railway Station, College Road', '07:30', '08:30', 35, 1500.00);

-- Notices
INSERT INTO Notice (posted_by, title, body, audience, priority, is_published, publish_date) VALUES
(1, 'Semester Registration Open', 'Spring 2026 semester registration is now open. Please register before the deadline.', 'Students', 1, TRUE, NOW()),
(1, 'Faculty Meeting', 'All faculty members are requested to attend a meeting on Friday.', 'Faculty', 2, TRUE, NOW());

-- Events
INSERT INTO Event (organized_by, dept_id, title, description, event_type, start_datetime, end_datetime, venue, max_participants) VALUES
(1, 1, 'Annual Programming Contest 2026', 'Inter-university programming contest. Register now!', 'Academic', '2026-02-15 09:00', '2026-02-15 17:00', 'Computer Lab', 100),
(1, NULL, 'Sports Day 2026', 'Annual sports day. All are welcome.', 'Sports', '2026-03-01 08:00', '2026-03-01 18:00', 'University Ground', 500);

