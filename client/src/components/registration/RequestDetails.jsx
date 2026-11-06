import { format } from 'date-fns';
import { isFacultyRequest } from '../../utils/registrationRequest.js';

const LEVEL_LABELS = { class_10: 'Class 10', class_12: 'Class 12', diploma: 'Diploma', degree: 'Degree', other: 'Other' };

function Row({ label, children }) {
  if (children === undefined || children === null || children === '') return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-xs font-medium text-slate">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section>
      <h3 className="border-b border-line pb-1.5 font-display text-sm font-semibold text-ink">{title}</h3>
      <dl className="divide-y divide-line/60">{children}</dl>
    </section>
  );
}

const years = (value) => `${value} ${Number(value) === 1 ? 'year' : 'years'}`;

/** Read-only view of everything an applicant submitted, for the reviewing HOD. */
export default function RequestDetails({ request }) {
  const faculty = isFacultyRequest(request);
  const edu = request.previousEducation;
  const fe = request.facultyEducation;
  const exp = request.experience;
  return (
    <div className="flex flex-col gap-5">
      <Group title="Applicant">
        <Row label="Name">{request.name}</Row>
        <Row label="Requested account">{faculty ? 'Faculty' : 'Student'}</Row>
        <Row label="Email">{request.email}</Row>
        <Row label="Phone">{request.phone}</Row>
        <Row label="Date of birth">{request.dateOfBirth ? format(new Date(request.dateOfBirth), 'd MMM yyyy') : null}</Row>
        <Row label={faculty ? 'Department' : 'Requested class'}>{faculty ? request.department?.name : request.class?.name}</Row>
        {!faculty && <Row label="Department">{request.department?.name}</Row>}
        <Row label="Submitted">{format(new Date(request.createdAt), 'd MMM yyyy, h:mm a')}</Row>
      </Group>

      {!faculty && (
        <Group title="Previous education">
          {edu ? (
            <>
              <Row label="Last completed">{edu.level === 'other' && edu.levelOther ? `Other: ${edu.levelOther}` : LEVEL_LABELS[edu.level] || edu.level}</Row>
              <Row label="School or college">{edu.institution}</Row>
              <Row label="Board or university">{edu.boardOrUniversity}</Row>
              <Row label="Year of completion">{edu.yearOfCompletion}</Row>
              <Row label="Marks">{typeof edu.percentage === 'number' ? `${edu.percentage}%` : null}</Row>
              <Row label="Other result">{edu.alternativeResult}</Row>
            </>
          ) : <p className="py-2 text-sm text-slate">Not provided. This request was submitted before education details were collected.</p>}
        </Group>
      )}

      {faculty && (
        <>
          <Group title="Educational background">
            {fe ? (
              <>
                <Row label="Highest qualification">{fe.qualification}</Row>
                <Row label="Specialization">{fe.specialization}</Row>
                <Row label="Institution">{fe.institution}</Row>
                <Row label="Year of completion">{fe.yearOfCompletion}</Row>
              </>
            ) : <p className="py-2 text-sm text-slate">Not provided. This request was submitted before education details were collected.</p>}
          </Group>
          <Group title="Professional experience">
            {exp ? (
              <>
                <Row label="Total experience">{years(exp.totalYears)}</Row>
                {exp.totalYears > 0 ? (
                  <>
                    <Row label="Previous workplace">{exp.previousInstitution}</Row>
                    <Row label="Previous role">{exp.previousRole}</Row>
                  </>
                ) : <p className="py-2 text-sm text-slate">No previous employment.</p>}
              </>
            ) : <p className="py-2 text-sm text-slate">Not provided.</p>}
          </Group>
        </>
      )}

      {request.status !== 'pending' && (
        <Group title="Decision">
          <Row label="Status"><span className="capitalize">{request.status}</span></Row>
          <Row label="Reviewed by">{request.reviewedBy?.name}</Row>
          <Row label="Reviewed on">{request.reviewedAt ? format(new Date(request.reviewedAt), 'd MMM yyyy, h:mm a') : null}</Row>
          <Row label="Assigned ID">{request.assignedIdentifier}</Row>
          <Row label="Reason">{request.rejectionReason}</Row>
        </Group>
      )}
    </div>
  );
}
