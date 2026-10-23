package com.exam.secureexam.model;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Objects;

@Entity
@Table(name = "candidate_slots")
@IdClass(CandidateSlot.CandidateSlotId.class)
public class CandidateSlot {

    @Id
    @Column(name = "candidate_id")
    private Long candidateId;

    @Id
    @Column(name = "slot_id")
    private Long slotId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", insertable = false, updatable = false)
    private Candidate candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "slot_id", insertable = false, updatable = false)
    private ExamSlot slot;

    public CandidateSlot() {}

    public CandidateSlot(Long candidateId, Long slotId) {
        this.candidateId = candidateId;
        this.slotId = slotId;
    }

    public Long getCandidateId() { return candidateId; }
    public void setCandidateId(Long candidateId) { this.candidateId = candidateId; }

    public Long getSlotId() { return slotId; }
    public void setSlotId(Long slotId) { this.slotId = slotId; }

    public Candidate getCandidate() { return candidate; }
    public void setCandidate(Candidate candidate) { this.candidate = candidate; }

    public ExamSlot getSlot() { return slot; }
    public void setSlot(ExamSlot slot) { this.slot = slot; }

    public static class CandidateSlotId implements Serializable {
        private Long candidateId;
        private Long slotId;

        public CandidateSlotId() {}

        public CandidateSlotId(Long candidateId, Long slotId) {
            this.candidateId = candidateId;
            this.slotId = slotId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            CandidateSlotId that = (CandidateSlotId) o;
            return Objects.equals(candidateId, that.candidateId) && Objects.equals(slotId, that.slotId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(candidateId, slotId);
        }
    }
}
