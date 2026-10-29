import { useState, useEffect, useRef } from "react";
import { Clock3 } from "lucide-react";

interface ExamTimerProps {
  deadline: number;
  isSubmitted: boolean;
  onExpire: () => void;
}

export default function ExamTimer({ deadline, isSubmitted, onExpire }: ExamTimerProps) {
  // Compute initial remaining seconds using absolute deadline timestamp
  const calculateRemainingSeconds = () => {
    if (!deadline || deadline <= 0 || isNaN(deadline)) {
      return null;
    }
    const diff = Math.floor((deadline - Date.now()) / 1000);
    return Math.max(0, diff);
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(calculateRemainingSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (isSubmitted || !deadline || deadline <= 0 || isNaN(deadline)) {
      return;
    }

    // Check immediately upon mount with valid deadline
    const initialRemaining = calculateRemainingSeconds();
    if (initialRemaining === null) return;

    setRemainingSeconds(initialRemaining);

    if (initialRemaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateRemainingSeconds();
      if (remaining === null) return;
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, isSubmitted, onExpire]);

  const displaySeconds = remainingSeconds ?? 3600;
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;

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
