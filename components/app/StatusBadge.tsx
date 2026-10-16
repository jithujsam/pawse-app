const CANDIDATE: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  pending: { label: "Not sent", tone: "neutral" },
  invited: { label: "Invited", tone: "neutral" },
  in_progress: { label: "Answering", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  opted_out: { label: "Opted out", tone: "warning" },
  needs_human: { label: "Needs you", tone: "warning" },
  no_response: { label: "No response", tone: "neutral" },
  deleted: { label: "Deleted", tone: "neutral" },
};

const JOB: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Screening", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export function CandidateStatus({ status }: { status: string }) {
  const s = CANDIDATE[status] ?? { label: status, tone: "neutral" };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}

export function JobStatus({ status, testMode }: { status: string; testMode?: boolean }) {
  const s = JOB[status] ?? { label: status, tone: "neutral" };
  return (
    <span className="inline-flex gap-1.5">
      <span className={`badge badge-${s.tone}`}>{s.label}</span>
      {testMode && <span className="badge badge-neutral">Test mode</span>}
    </span>
  );
}

export function candidateStatusLabel(status: string) {
  return CANDIDATE[status]?.label ?? status;
}
