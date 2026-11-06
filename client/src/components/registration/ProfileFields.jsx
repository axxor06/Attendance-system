import Input from '../common/Input.jsx';
import Select from '../common/Select.jsx';
import { EDUCATION_LEVELS, hasExperience } from '../../utils/registrationProfile.js';

export function FormSection({ title, description, children }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border-t border-line pt-5">
      <legend className="float-left mb-0 w-full pb-4">
        <span className="block font-display text-base font-semibold text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate">{description}</span>}
      </legend>
      <div className="clear-both flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

const grid = 'grid grid-cols-1 gap-4 sm:grid-cols-2';

/** Previous education for student applicants. `errors` is a field -> message map. */
export function StudentEducationFields({ values, errors = {}, onChange }) {
  const set = (field) => (event) => onChange(field, event.target.value);
  return (
    <FormSection title="Previous education" description="Tell us about the last course you completed before joining.">
      <Select label="Last completed education" required value={values.level} onChange={set('level')} error={errors.level}>
        <option value="">Select education level</option>
        {EDUCATION_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
      </Select>
      {values.level === 'other' && (
        <Input label="Describe the education level" required value={values.levelOther} onChange={set('levelOther')} error={errors.levelOther} maxLength={60} placeholder="For example, IB Diploma" />
      )}
      <Input label="Previous school or college" required value={values.institution} onChange={set('institution')} error={errors.institution} maxLength={150} />
      <div className={grid}>
        <Input label="Board or university" required value={values.boardOrUniversity} onChange={set('boardOrUniversity')} error={errors.boardOrUniversity} maxLength={150} />
        <Input label="Year of completion" required inputMode="numeric" value={values.yearOfCompletion} onChange={set('yearOfCompletion')} error={errors.yearOfCompletion} maxLength={4} placeholder="2025" />
      </div>
      <div className={grid}>
        <Input label="Marks obtained (%)" inputMode="decimal" value={values.percentage} onChange={set('percentage')} error={errors.percentage} placeholder="82.5" hint={!errors.percentage ? 'Up to two decimals.' : undefined} />
        <Input label="Other result (optional)" value={values.alternativeResult} onChange={set('alternativeResult')} error={errors.alternativeResult} maxLength={60} placeholder="CGPA 8.4, Grade A" hint={!errors.alternativeResult ? 'For systems without percentages.' : undefined} />
      </div>
    </FormSection>
  );
}

/** Education + experience for faculty applicants. Zero experience hides the employment fields. */
export function FacultyProfileFields({ values, errors = {}, onChange }) {
  const set = (field) => (event) => onChange(field, event.target.value);
  const worked = hasExperience(values);
  return (
    <>
      <FormSection title="Educational background" description="Your highest completed qualification.">
        <div className={grid}>
          <Input label="Highest qualification" required value={values.qualification} onChange={set('qualification')} error={errors.qualification} maxLength={120} placeholder="M.Tech, Ph.D" />
          <Input label="Specialization or subject" required value={values.specialization} onChange={set('specialization')} error={errors.specialization} maxLength={120} />
        </div>
        <div className={grid}>
          <Input label="Institution" required value={values.institution} onChange={set('institution')} error={errors.institution} maxLength={150} />
          <Input label="Year of completion" required inputMode="numeric" value={values.yearOfCompletion} onChange={set('yearOfCompletion')} error={errors.yearOfCompletion} maxLength={4} placeholder="2018" />
        </div>
      </FormSection>
      <FormSection title="Professional experience" description="Fresh graduates can enter 0 and skip the employment details.">
        <Input label="Total experience (years)" required inputMode="decimal" value={values.totalYears} onChange={set('totalYears')} error={errors.totalYears} placeholder="0" hint={!errors.totalYears ? 'For example 0, 1, 2.5 or 12.' : undefined} />
        {worked && (
          <div className={grid}>
            <Input label="Previous workplace" required value={values.previousInstitution} onChange={set('previousInstitution')} error={errors.previousInstitution} maxLength={150} />
            <Input label="Previous role or designation" required value={values.previousRole} onChange={set('previousRole')} error={errors.previousRole} maxLength={100} />
          </div>
        )}
      </FormSection>
    </>
  );
}
