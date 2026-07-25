@echo off
REM =====================================================================
REM UniSphere / EduHub - run_seed.bat (Windows equivalent of run_seed.sh)
REM =====================================================================
REM Required environment:
REM   SUPABASE_URL             e.g. https://xxx.supabase.co
REM   SUPABASE_SERVICE_ROLE_KEY   service_role JWT
REM   SUPABASE_DB_URL          postgresql://postgres:...@db.xxx.supabase.co:5432/postgres
REM
REM Optional:
REM   SEED_IDS_OUT             default %TEMP%\seed_ids.json
REM =====================================================================

setlocal EnableDelayedExpansion

if "%SUPABASE_URL%"=="" goto :env_error
if "%SUPABASE_SERVICE_ROLE_KEY%"=="" goto :env_error
if "%SUPABASE_DB_URL%"=="" goto :env_error

if "%SEED_IDS_OUT%"=="" set "SEED_IDS_OUT=%TEMP%\seed_ids.json"

set "SCRIPT_DIR=%~dp0"
set "SEED_PY=%SCRIPT_DIR%seed.py"
set "SEED_SQL=%SCRIPT_DIR%..\Database\seed.sql"

if not exist "%SEED_SQL%" (
    echo ERROR: seed.sql not found at %SEED_SQL% 1>&2
    exit /b 2
)

echo Step 1/2: Provisioning auth.users via Supabase Admin API...
python "%SEED_PY%" --out "%SEED_IDS_OUT%"
if errorlevel 1 (
    echo ERROR: seed.py failed 1>&2
    exit /b 1
)

if not exist "%SEED_IDS_OUT%" (
    echo ERROR: seed.py produced no output at %SEED_IDS_OUT% 1>&2
    exit /b 2
)

echo.
echo Step 2/2: Running Database\seed.sql against %SUPABASE_DB_URL% ...
for /f "usebackq delims=" %%i in ("%SEED_IDS_OUT%") do set "SEED_JSON=%%i"

psql "%SUPABASE_DB_URL%" -v ON_ERROR_STOP=1 -v seed_ids_json="%SEED_JSON%" -f "%SEED_SQL%"
if errorlevel 1 (
    echo ERROR: psql failed 1>&2
    exit /b 1
)

echo.
echo Seed complete. Verify with:
echo     psql "%SUPABASE_DB_URL%" -c "SELECT COUNT(*) FROM public.student;"
echo     psql "%SUPABASE_DB_URL%" -c "SELECT COUNT(*) FROM public.instructor;"
echo     psql "%SUPABASE_DB_URL%" -c "SELECT COUNT(*) FROM public.manual_course;"
exit /b 0

:env_error
echo ERROR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL must be set. 1>&2
exit /b 2
