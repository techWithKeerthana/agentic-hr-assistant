"""Create a synthetic Employee Handbook PDF with realistic HR policies."""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

SECTIONS = [
    ("Employee Handbook — Northwind Company", None),
    ("1. Working Hours", """
Standard working hours are 9:00 AM to 6:00 PM, Monday through Friday.
The company offers flexible working hours — employees may start between 8:00 AM and 10:00 AM
and adjust their end time accordingly, with manager approval.
Core hours where all employees must be available are 10:00 AM to 4:00 PM.
Lunch break is 1 hour, typically between 12:00 PM and 2:00 PM.
The standard work week is 40 hours. Any work beyond 40 hours must be pre-approved.
"""),
    ("2. Leave Policy", """
Annual Leave: Full-time employees receive 15 days of paid annual leave per calendar year.
Sick Leave: 10 days of paid sick leave per year. A medical certificate is required for absences exceeding 3 consecutive days.
Casual Leave: 6 days per year for personal emergencies.
Maternity Leave: 26 weeks of paid maternity leave as per statutory requirements.
Paternity Leave: 5 days of paid paternity leave.
Bereavement Leave: 3 days for immediate family members.
Unused annual leave up to 10 days can be carried forward to the next calendar year.
Leave requests must be submitted via the HR portal at least 2 weeks in advance for annual leave.
"""),
    ("3. Remote Work Policy", """
Employees are eligible for up to 2 days of remote work per week after completing 3 months of employment.
Remote work must be pre-approved by the direct manager.
Employees must be available on all communication channels during standard working hours while working remotely.
Remote work is not permitted during the first week of a new project or during critical deadlines.
The company provides a monthly internet allowance of $30 for remote workers.
Employees must ensure a secure and professional work environment when working from home.
"""),
    ("4. Performance Reviews", """
Performance reviews are conducted bi-annually — in June and December each year.
New employees receive a 90-day probationary review within their first quarter.
The review process includes self-assessment, manager evaluation, and peer feedback (360-degree review).
Performance ratings: Exceptional, Exceeds Expectations, Meets Expectations, Needs Improvement.
Salary increments and promotions are tied to the December performance review cycle.
Employees rated Needs Improvement for two consecutive cycles may be placed on a Performance Improvement Plan (PIP).
All review documentation is stored confidentially in the HR system.
"""),
    ("5. Overtime Policy", """
Overtime is defined as any work beyond 48 hours per week.
Overtime must be pre-approved in writing by the department head.
Overtime compensation is 1.5x the regular hourly rate for weekdays.
Weekend overtime is compensated at 2x the regular hourly rate.
Compensatory time off (comp-off) may be granted instead of overtime pay at manager discretion.
Maximum overtime is limited to 12 hours per week.
Overtime logs must be submitted to HR within 3 business days of the overtime worked.
"""),
    ("6. Code of Conduct", """
All employees are expected to maintain professional behavior at all times.
Harassment, discrimination, or bullying of any kind will result in immediate disciplinary action.
Employees must maintain confidentiality of company and client information.
Conflicts of interest must be disclosed to HR immediately.
Employees must not engage in any outside employment that conflicts with company interests without written approval.
Dress code is business casual from Monday to Thursday; casual Fridays are permitted.
Violations of the code of conduct are subject to disciplinary action up to and including termination.
"""),
    ("7. Public Holidays", """
The company observes 10 public holidays per year:
New Year's Day (January 1), Martin Luther King Jr. Day (third Monday in January),
Presidents' Day (third Monday in February), Memorial Day (last Monday in May),
Independence Day (July 4), Labor Day (first Monday in September),
Thanksgiving Day (fourth Thursday in November), Day after Thanksgiving,
Christmas Eve (December 24), Christmas Day (December 25).
When a holiday falls on a weekend, the nearest weekday is observed.
Employees may also take 2 floating holidays per year on dates of their choice.
"""),
    ("8. Employee Benefits", """
Health Insurance: Company covers 80% of premium for employee and 50% for dependents.
Dental and Vision: Covered at 70% for employee.
401(k): Company matches up to 4% of salary.
Professional Development: $1,500 annual budget for courses, certifications, and conferences.
Gym Membership: $50 monthly reimbursement for fitness activities.
Employee Assistance Program (EAP): Free counseling and mental health support, up to 8 sessions per year.
Life Insurance: Company-provided coverage equal to 2x annual salary.
"""),
    ("9. Grievance Policy", """
Employees with workplace grievances should first attempt resolution with their direct manager.
If unresolved within 5 business days, the grievance may be escalated to HR.
HR will acknowledge the grievance within 2 business days and investigate within 15 business days.
All grievances are handled confidentially.
Retaliation against employees who raise genuine grievances is strictly prohibited and may result in disciplinary action.
Employees may request an anonymous grievance process; HR will investigate while protecting the employee's identity.
"""),
    ("10. IT and Equipment Policy", """
Company-issued laptops and equipment remain the property of the company.
Employees must not install unauthorized software on company devices.
Company data must not be stored on personal devices without encryption.
Employees must use strong passwords and enable two-factor authentication on all company accounts.
Lost or stolen equipment must be reported to IT within 4 hours.
Upon resignation or termination, all company equipment must be returned within 2 business days.
Violation of IT policies may result in disciplinary action and personal liability for data breaches.
"""),
    ("11. Hiring and Onboarding", """
All new hires must complete onboarding within their first two weeks of employment.
Onboarding includes orientation, IT setup, compliance training, and department introductions.
Background checks are conducted for all full-time employees prior to start date.
New employees are assigned a buddy from their team for the first 30 days.
Probationary period for new employees is 90 days.
During probation, employees may be terminated with 1 week notice if performance is unsatisfactory.
"""),
    ("12. Resignation and Exit Policy", """
Employees are required to give a minimum of 2 weeks notice before resignation.
Senior roles (Manager and above) require 4 weeks notice.
Exit interviews are conducted by HR for all departing employees.
All company property including laptops, access cards, and documents must be returned on the last working day.
Final paycheck including any accrued but unused leave will be processed within 7 business days.
Non-disclosure and non-compete clauses in employment contracts remain in effect after termination.
"""),
]


def create_handbook(output_path: str = "data/employee_handbook.pdf"):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(output_path, pagesize=letter,
                            leftMargin=inch, rightMargin=inch,
                            topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=18, spaceAfter=20)
    heading_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, spaceAfter=8, spaceBefore=18)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=16, spaceAfter=6)

    story = []
    for i, (heading, content) in enumerate(SECTIONS):
        if i == 0:
            story.append(Paragraph(heading, title_style))
        else:
            story.append(Paragraph(heading, heading_style))
            if content:
                for line in content.strip().splitlines():
                    line = line.strip()
                    if line:
                        story.append(Paragraph(line, body_style))
        story.append(Spacer(1, 0.08 * inch))

    doc.build(story)
    print(f"Created {output_path}")


if __name__ == "__main__":
    import os, sys
    sys.path.insert(0, ".")
    os.chdir("C:/Intelligent/agentic-hr-assistant/backend")
    create_handbook()
