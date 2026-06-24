import os

def generate_mock_circulars():
    os.makedirs("../circulars/incoming", exist_ok=True)
    os.makedirs("../circulars/sample-circulars", exist_ok=True)
    
    circulars = [
        {
            "filename": "rbi_it_governance_2023.txt",
            "content": """RESERVE BANK OF INDIA
Master Direction on Information Technology Governance, Risk, Controls and Assurance Practices
Ref: RBI/2023-24/107
Date: November 7, 2023

Subject: IT Governance and Cyber Security Controls

All Commercial Banks, NBFCs, and Credit Information Companies are directed to implement the following:
1. Establish a Board-level IT Strategy Committee to oversee IT governance.
2. Ensure strict physical and environmental controls for Data Centres and Disaster Recovery sites.
3. Implement robust Identity & Access Management (IAM) and privileged access controls.
4. Adopt internationally accepted cryptographic standards for data in transit and at rest.
5. All critical third-party IT vendor risks must be periodically assessed.

Deadline for compliance: April 1, 2024.
"""
        },
        {
            "filename": "cert_in_directions_2022.txt",
            "content": """INDIAN COMPUTER EMERGENCY RESPONSE TEAM (CERT-In)
Ref: CERT-In Directions under Section 70B
Date: April 28, 2022

Subject: Mandatory Cyber Incident Reporting and Vulnerability Management

To all Service Providers, Intermediaries, Data Centres, and Corporate Entities:
1. All severe cyber incidents (ransomware, data breaches) must be reported to CERT-In within 6 hours of noticing.
2. Entities must synchronize their IT system clocks to the NTP servers of NIC or NPL.
3. Maintain secure logs of all IT systems for a rolling period of 180 days within Indian jurisdiction.
4. Conduct vulnerability assessment and penetration testing (VAPT) at least once a year.

Deadline for immediate compliance with 6-hour reporting.
"""
        },
        {
            "filename": "rbi_digital_payment_security.txt",
            "content": """RESERVE BANK OF INDIA
Master Direction on Digital Payment Security Controls
Ref: RBI/2020-21/74

Subject: Enhancing Security of Digital Payment Channels

Applicable to Scheduled Commercial Banks, Small Finance Banks, and Payment Banks:
1. Implement Multi-Factor Authentication (MFA) for all digital payment transactions.
2. Put in place mechanisms to detect and block suspicious transactions based on velocity and behavioral patterns.
3. Secure the APIs used for Open Banking and Fintech integrations with rate limiting and mutual TLS authentication.
4. Establish a dedicated Security Operations Center (SOC) for 24x7 threat monitoring.

Entities must comply with these guidelines to ensure safety of consumer funds.
"""
        }
    ]
    
    for circ in circulars:
        path = os.path.join("../circulars/sample-circulars", circ["filename"])
        with open(path, "w", encoding="utf-8") as f:
            f.write(circ["content"].strip())
        print(f"Generated mock circular: {path}")

def generate_mock_evidence():
    os.makedirs("../evidence", exist_ok=True)
    evidence_files = [
        {
            "filename": "it_strategy_committee_minutes.txt",
            "content": "Board Meeting Minutes - Jan 2024\nResolution Passed: The Board has officially formed the IT Strategy Committee comprising three independent directors. IAM controls have been upgraded."
        },
        {
            "filename": "cert_in_log_retention_policy.txt",
            "content": "Log Retention Policy v2.0\nAll system logs are now configured to be retained for 180 days on the central SIEM server located in the Mumbai Data Center, fully compliant with CERT-In 2022 directives."
        }
    ]
    
    for ev in evidence_files:
        path = os.path.join("../evidence", ev["filename"])
        with open(path, "w", encoding="utf-8") as f:
            f.write(ev["content"].strip())
        print(f"Generated compliant evidence: {path}")

if __name__ == "__main__":
    generate_mock_circulars()
    generate_mock_evidence()
