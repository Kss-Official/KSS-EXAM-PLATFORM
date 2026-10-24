import { useState, useEffect, useRef } from "react";
import { Clock3, AlertTriangle } from "lucide-react";

interface ExamTimerProps {
  deadline: number;
  isSubmitted: boolean;
  onExpire: () => void;
}

export default function ExamTimer({ deadline, isSubmitted, onExpire }: ExamTimerProps) {
  // Compute initial remaining seconds using absolute deadline timestamp
  const calculateRemainingSeconds = () => {
    const diff = Math.floor((deadline - Date.now()) / 1000);
    return Math.max(0, diff);
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number>(calculateRemainingSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (isSubmitted) {
      return;
    }

    // Check immediately upon mount
    const initialRemaining = calculateRemainingSeconds();
    setRemainingSeconds(initialRemaining);

    if (initialRemaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateRemainingSeconds();
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, isSubmitted, onExpire]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isLowTime = remainingSeconds > 0 && remainingSeconds <= 300; // < 5 minutes
  const isUrgent = remainingSeconds > 0 && remainingSeconds <= 60; // < 1 minute

  return (
    <div
      className="exam-timer-pill"
      title="Exam Time Remaining"
      aria-label={`Time remaining: ${minutes} minutes and ${seconds} seconds`}
    >
      <Clock3 size={15} color="#017846" />
      <span className="exam-timer-digits">{String(minutes).padStart(2, "0")} : {String(seconds).padStart(2, "0")}</span>
    </div>
  );
}
