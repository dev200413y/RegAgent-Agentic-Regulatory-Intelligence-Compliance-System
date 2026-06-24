@echo off
echo Starting RegAgent...

echo Checking if Ollama is running...
start cmd /k "ollama serve"
timeout /t 2 /nobreak > nul

echo Starting FastAPI Backend...
cd backend
start cmd /k ".\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd ..

echo Starting React Frontend...
cd frontend
start cmd /k "npm run dev"
cd ..

echo All services started! Opening browser...
timeout /t 3 /nobreak > nul
start http://localhost:5173
