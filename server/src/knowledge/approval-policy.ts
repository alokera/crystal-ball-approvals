/**
 * Approval-policy note: the only source "Help me" may answer from.
 * Kept as a TS string so it ships with the build and needs no file I/O.
 */
export const POLICY_MARKDOWN = `
# Approvals & Review Policy — OomniEye Digital Twin

## Review turnaround (SLA)
Every item in the Pending Review queue must receive a decision within 48 hours of submission. Safety-related items (PPE, sensors, gas detection, emergency procedures) have a 24-hour SLA. Items older than their SLA are flagged overdue and must be handled before newer work.

## How to review an item
Open the item from the queue and check three things: (1) the content is complete and readable: videos play end-to-end, PDFs are not password-protected, images are full resolution; (2) it is filed in the correct folder or card; (3) it matches the current site standard. Use Snapshot & Control to compare the item with the live digital twin before deciding.

## Approve, reject or request changes
Approve when all checks pass. Choose Request changes when the fix is small (wrong folder, missing page) and comment exactly what to fix. Reject only when the content is wrong, outdated or unsafe; a rejection must include a reason, which is sent to the submitter. You cannot approve your own submission.

## Escalation
Escalate to the Site Safety Lead immediately if an item reveals a safety hazard, missing PPE, or a sensor below spec. Escalate to the HMS Panel owner when a submission affects camera coverage or zone layouts. If you are unsure, comment and assign the item to a senior reviewer instead of approving.

## Media-specific checks
Video: confirm the date and time overlay, and that members of the public are blurred. Images and 360° captures: confirm camera IDs match the zone map. Folders: every checklist inside must have an owner and a revision date.
`.trim();
