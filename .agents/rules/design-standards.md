# FixIT Institutional Design & UI Standards

When designing, refactoring, or styling any component or view in this project, adhere strictly to the following standards:

## 1. Color Usage: Semantic, Not Decorative
- **Single Dominant Brand Accent**: Use one primary brand accent throughout the interface for interactive elements and brand presence.
- **Strict Status Mapping**: Never assign rainbow/pastel accent colors to stat cards or sections merely for visual variety. Colors must carry strict domain meaning:
  - **Red / Amber**: Urgent, overdue, critical errors, attention needed.
  - **Green**: Completed, resolved, approved, operational/success.
  - **Blue / Neutral**: In-progress, informational, default states.
  - **Gray / Muted**: Closed, archived, disabled, secondary metadata.
- If a color does not convey real status, use neutral/border hierarchy instead.

## 2. Tone: Official & Institutional
- **No Conversational Chatbot Headers**: Avoid "Good morning/evening, [User]". Use direct, functional headers (e.g., "Facility & Asset Work Orders", "Dashboard Overview", "Job Request Management").
- **Formal System Chrome**: Keep labels, buttons, alerts, tooltips, and empty states clean and professional. Avoid emojis, exclamation marks, or casual phrasing.

## 3. Anti-Patterns to Avoid
- **No Soft Pastel Icon Badges**: Avoid generic soft-pastel rounded square icon tiles for metric cards. Use structured data typography, compact metric layouts, or functional status tags.
- **Domain-Specific Empty States**: Customize empty states with actionable, workflow-relevant instructions rather than generic outline icons with "No items found".
- **Contextual Copy**: Reference actual departments, equipment categories, job roles (PDAS, Building Maintenance, Technician, Requesting Unit), and official form workflows.

## 4. Information Density & Layout
- **Operations Console Density**: For admin, technician, and staff views used daily, prioritize high data density, compact tables, crisp borders, and minimal decorative padding.
- **Clear Scannability**: Ensure priority tickets, SLA deadlines, assigned technicians, and approval workflows are immediately scannable without unnecessary whitespace.

## 5. Typography & Identity
- Maintain crisp, institutional typographic hierarchy (weights, mono numbers for IDs/dates/totals, clean line heights).
- Align all visual elements with the FixIT operational & facility management identity.
