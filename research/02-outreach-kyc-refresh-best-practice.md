# Research 02 — Outreach, KYC refresh, pre-approval and data-quality best practice (regulatory analogues)

Researched 7 October 2026 for the QIB pre-approval remediation platform (Jahiz). Every claim carries its source. Items marked UNVERIFIED could not be confirmed. Where a number is needed and no regulation supplies one, the parameter table at the end says "design default — no regulatory source".

---

## 1. Customer contact policy parameters

### 1.1 Contact frequency limits by regime

US — CFPB Regulation F (12 CFR 1006.14(b)): a collector is presumed compliant if it calls "neither (A) more than seven times within seven consecutive days; nor (B) within a period of seven consecutive days after having had a telephone conversation". https://www.consumerfinance.gov/rules-policy/regulations/1006/14/

Australia — ACCC/ASIC Debt Collection Guideline: maximum "3 phone calls a week or 10 a month"; hours weekdays 7:30am–9pm, weekends 9am–9pm; no contact on national public holidays; workplace contact only in working hours. https://www.accc.gov.au/consumers/debt/what-debt-collectors-cant-do

Saudi Arabia — SAMA Debt Collection Regulations for Individual Customers (2018): "The number of attempts to contact a consumer through their phone number must not exceed ten attempts within a period of 30 days." Channels: e-mail, registered mail, national address, SMS, phone. All calls recorded and kept ≥ 10 years; the customer is told the call is recorded; messages state the department's working hours. https://rulebook.sama.gov.sa/en/node/1696

UAE — CBUAE Consumer Protection Standards Art. 5, clause 5.2.5.6: collection contact only by e-mail, registered mail, courier, SMS, phone or a consented method; telephone attempts "must only be made during the hours of 9 AM to 8 PM"; no "unreasonable and excessive number of communication attempts"; no home/workplace visits without consent. 5.2.5.7: communications recorded and kept 5 years after settlement. https://rulebook.centralbank.ae/en/rulebook/article-5-business-conduct

UK — FCA CONC 7.9.4R: no contact at unreasonable times; regard to reasonable requests (shift workers). No numeric cap; firms must have a documented, reasonable approach. CONC 7.3.4R: forbearance and due consideration. https://handbook.fca.org.uk/handbook/conc7/conc7s9 ; https://handbook.fca.org.uk/handbook/conc7/conc7s3 ; https://www.fdcapital.co.uk/conc-guide/

UK community-lender practice (Fair4All Finance 2025): collections actions "should not be undertaken more than once a day" and within 9–5 unless the customer asks otherwise. https://fair4allfinance.org.uk/wp-content/uploads/2025/11/RM11-Arrears-and-Collections-Strategy.pdf

### 1.2 Permitted contact hours

US TCPA 47 CFR 64.1200(c)(1): no solicitation before 8 a.m. or after 9 p.m. local time. https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200 — Reg F 1006.6(b)(1): before 8:00 a.m. and after 9:00 p.m. presumed inconvenient. https://www.consumerfinance.gov/rules-policy/regulations/1006/6/ — stricter state windows exist (8–8, 9–6 etc.). https://activeprospect.com/blog/tcpa-calling-hours/

UAE — Cabinet Resolution No. 56 of 2024: marketing calls only 9:00am–6:00pm; explicit prior consent; Do Not Call Registry. https://www.mondaq.com/advertising-marketing-branding/1495836/new-telemarketing-regulations-introduced-in-uae — CBUAE draft telemarketing regulation for LFIs (2025, consultation): Mon–Fri 9am–6pm, Sat–Sun 12pm–5pm, none on official holidays; institution-level do-not-call list; board approval of campaigns. https://gulfnews.com/business/banking/uae-central-bank-plans-comprehensive-regulation-for-telemarketing-financial-products-and-services-1.500323886

### 1.3 Do-not-contact / opt-out handling

Reg F 1006.6(c)(1): written cease-communication request stops contact on that debt; 1006.6(e): every electronic message carries a clear, simple opt-out. TCPA: do-not-call requests honoured within "a reasonable time ... not to exceed ten business days". CBUAE 5.1.1.9: consumers are opted out of promotional communication unless they opted in; 5.1.1.68(a): no repeated solicitation after opt-out; 5.1.1.10: LFIs "are prohibited from marketing loans/financing ... through direct contact by telephone". CBUAE 6.1.3.4: expressed consent before direct marketing; consent records kept 5 years after the relationship ends. https://rulebook.centralbank.ae/node/4236

Design implication: a KYC/document-update request is a service or regulatory message, not marketing; marketing opt-outs should not suppress it. A pre-approved offer is marketing and must respect opt-in status. ICO guidance: a neutral regulatory communication with no promotion "is unlikely to count as direct marketing", the same content with promotional phrasing is. https://ico.org.uk/for-organisations/direct-marketing/direct-marketing-and-regulatory-communications

### 1.4 Channel consent — WhatsApp Business

Meta policy: contact only with the number and opt-in permission; free-form replies within 24 hours of the last user message, approved templates outside it; honour all opt-outs; low quality ratings throttle volume. https://business.whatsapp.com/policy ; https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in ; https://www.infobip.com/en/blog/how-to-collect-whatsapp-business-opt-ins — Emirates NBD reported 771 thousand WhatsApp Banking subscribers in 2024. https://www.emiratesnbd.com/en/-/media/enbd/files/investor-relations/financial-information/presentations/emiratesnbd_investor_presentation_2025_q1.pdf

### 1.5 Quiet periods

ACCC/ASIC: no contact on national public holidays, reduced weekend window. CBUAE draft: none on official holidays, shorter weekend window. Ramadan: UAE working hours reduced by 2 hours/day (Cabinet Resolution No. 1 of 2022). https://gulfnews.com/uae/ramadan/ramadan-working-hours-in-uae-for-public-and-private-sectors-explained-1.500433650 — ADIB offered a one-month instalment deferral in Ramadan 2021. https://gulfnews.com/business/banking/ramadan-2021-abu-dhabi-islamic-bank-to-postpone-1-month-loan-installment-for-retail-clients-1.1618217063335 — UNVERIFIED: no published GCC regulator rule or bank policy sets specific Ramadan contact windows. Any Ramadan window is a design default.

## 2. KYC / CDD periodic refresh practice

### 2.1 FATF baseline
Recommendation 10: ongoing due diligence; keep documents, data and information "up-to-date and relevant by undertaking reviews of existing records, particularly for higher-risk categories". https://cfatf-gafic.org/index.php/documents/fatf-40r/376-fatf- — Recommendation 11: CDD records kept ≥ 5 years after the relationship ends. https://cfatf-gafic.org/documents/fatf-40r/377-fatf-recommendation-11-record-keeping

### 2.2 Risk-based refresh cycles
- CBUAE CDD/KYC Guidance 3.4.1: annually (high), every two years (medium), every three years (low), plus event triggers (change of domicile/name, STR, blocked transactions, higher-risk product, employment change, outdated information, screening hits). https://rulebook.centralbank.ae/en/rulebook/341-risk-based-periodic-and-event-driven-reviews
- Central Bank of Trinidad and Tobago (2025): annually (high), 3 years (standard), 5 years (low); policies must state actions and timelines when documentation is not obtained. https://www.central-bank.org.tt/cbtt_storage/2025/04/guidance-for-periodic-reviews-april2025.pdf
- FSC Mauritius (2026): yearly / 3 years / 4 years; triggers include "expired or invalid identification materials". https://www.fscmauritius.org/media/ndycko0f/guidelines_frequency-of-cdd.pdf
- RBI India: 2 / 8 / 10 years; low-risk may self-certify. https://factly.in/kyc-updation-low-risk-customers-must-done-every-10-years
- SAMA: retail update frequency not fixed; updates allowed through electronic banking with reliable identity verification. https://rulebook.sama.gov.sa/node/1671
- Wolfsberg (2022): move from periodic refresh toward trigger-based review. https://cbr.ru/Content/Document/File/139055/WG_G_DGL.PDF
- MAS Notice 626: no fixed cadence. https://www.tookitaki.com/compliance-hub/mas-notice-626-aml-cft-requirements-for-singapore-banks-and-financial-institutions
- HKMA: UNVERIFIED.

### 2.3 Expired identity documents — grace and restriction sequences
UAE — CBUAE 6.2.1.5: risk-based policy to update expired ID; after written notices and "a notice period of 90 calendar days", banks must temporarily block debit and credit cards (branch operations continue), no charges. https://rulebook.centralbank.ae/node/4236 — 2019 practice: SMS reminders, ID copies accepted via SMS, e-mail or RM. https://gulfnews.com/business/banking/some-uae-residents-credit-debit-cards-suspended-for-failing-to-update-emirates-id-details-banks-confirm-1.1553152666920 — In-app updates now standard. https://gulfnews.com/ask-gulf-news/ask-gulf-news-how-to-update-your-bank-kyc-in-the-uae-when-your-emirates-id-expires-1.500320726

Saudi — SAMA Rules for Bank Accounts: bank may freeze on ID expiry; must notify the freezing date ≥ 30 days in advance. https://rulebook.sama.gov.sa/en/node/1667

Kuwait (2018): one bank blocked immediately, five gave three months after expiry. https://kuwaittimes.com/update-your-contact-details-or-risk-having-account-blocked

Qatar — CBQ: non-response "will cause disruption or restrictions to services"; update via app or secure mail. https://www.cbq.com.qa/en/personal/know-your-customer — Banks send "multiple reminders" and may block, with extensions where passport renewal is delayed. https://thepeninsulaqatar.com/article/01/03/2021/Bank-customers-urged-to-update-documents-on-record

India — RBI: notice of three months, reminder for three more; partial freeze (credits allowed, debits blocked); full freeze after six further months. https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=9312 — RBI 2025: ≥ 3 advance intimations incl. one letter, ≥ 3 reminders after; low-risk individuals keep access one year after due. https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=12866

### 2.4 Request sequence
No regulator prescribes 90/60/30-day pre-expiry notices. Anchors: UAE 90-day written-notice period before card block; Saudi 30-day advance notice of freeze; India ≥ 3 pre and ≥ 3 post intimations. A T-90 / T-60 / T-30 / T0 / T+30 / T+60 cadence with card block at T+90 is a design default consistent with these.

### 2.5 Acceptable in-app document update
UK GPG 45: strength, validity (genuineness, expiry, security features, MRZ, chip), activity, fraud, verification (biometric match with anti-spoofing at score 3). https://www.gov.uk/government/publications/identity-proofing-and-verification-of-an-individual/how-to-prove-and-verify-someones-identity — EBA remote onboarding guidelines (2022): reliable reproductions, consistent automated capture, liveness detection. https://www.walkersglobal.com/Insights/2022/12/EBA-Publishes-Guidelines-on-Remote--Customer-Onboarding — McKinsey: "Self-service should be the default option for customers providing KYC information." https://www.mckinsey.com/industries/financial-services/our-insights/banking-matters/making-your-kyc-remediation-efforts-risk-and-value-based

## 3. Pre-approved / pre-screened credit offer practice

UAE — CBUAE Bank Loans Regulation (2011): instalments ≤ 50% of gross salary; personal loan ≤ 20× salary; tenor ≤ 48 months. https://rulebook.centralbank.ae/sites/default/files/en_net_file_store/CBUAE_EN_3920_VER1.pdf — Consumer Protection Standards Art. 7: affordability, stress test with written summary, DBR compliance; 7.1.3.5(e): no automatic card limit increase without expressed consent and an updated bureau check. https://rulebook.centralbank.ae/node/4237

Saudi — SAMA Responsible Lending Principles: salary-linked obligations ≤ 33.33% of gross salary (25% retirees); non-mortgage ≤ 45%; total ≤ 55%/65% by income band; salary verified via the employer; other income via two-year statements. https://rulebook.sama.gov.sa/node/1971

Bank rules: ADCB — minimum salary AED 5,000, mandatory salary and gratuity transfer, listed employer, age 21+. https://adcb.com/en/get-in-touch/faqs/loans/personal-loan — Emirates NBD T&Cs: transferring salary elsewhere without approval is an event of default. https://Emiratesnbd.com/-/media/enbd/files/loan/personal-loan/personal-loans-tc.pdf — DIB: customer must inform the bank of employer change. https://www.dib.ae/docs/default-source/cpr/warning/liabilities-warnings-en-ar-sia.pdf

Missing or irregular salary month: no regulatory rule. Practitioner guidance: review 2–3 months minimum; credits traceable to the employer, consistent date; gaps may be innocent (bonus month, job change, delayed payroll); repeated gaps or non-matching source are red flags (vendor source). https://precisa.in/blog/how-to-analyse-salary-credits-bank-statements/ — US mortgage analogues: FHA six-month gap rule; Fannie Mae three-year continuance. https://mortgageguidelines.com/fha-job-gap-history-of-employment/ ; https://selling-guide.fanniemae.com/sel/b3-3.1-01/general-income-information — Minimum continuous months and salary-variance tolerance: design defaults.

US FCRA prescreen: firm offers; opt-out five years or permanent; short and long notices. https://www.transunion.com/prescreen-opt-out ; https://www.ecfr.gov/current/title-16/chapter-I/subchapter-F/part-642

EU CCD2 (2023/2225): Art. 17 prohibits credit "without their prior request and explicit agreement"; Art. 18 creditworthiness on verified information, human intervention and explanation where automated; application 20 Nov 2026. https://lawplayer.com/eu/article/32023L2225/art_17 ; https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023L2225

Published eligibility/conversion statistics for pre-approved digital loans: none found. McKinsey mentions one bank whose "conversion rates tripled" after pre-approved top-ups and drop-offs cut "by up to 40 percent", no base rates. https://www.mckinsey.com/industries/financial-services/our-insights/banking-matters/ten-lessons-for-building-a-winning-retail-and-small-business-digital-lending-franchise — UNVERIFIED / not publicly available; do not cite a conversion figure.

## 4. Data quality monitoring for customer master data

DAMA UK six dimensions: accuracy, completeness, uniqueness, consistency, timeliness, validity. https://www.gov.uk/government/news/meet-the-data-quality-dimensions — ISO/IEC 25012 adds currentness, compliance, traceability. https://quality.arc42.org/standards/iso-iec-25012 — BCBS 239 Principles 3–6. https://en.wikipedia.org/wiki/BCBS_239

Mapping for this platform (design): expired ID = validity/currentness; missing salary credit = completeness/timeliness; unapproved employer = compliance against a reference list; name mismatch = consistency; duplicate customer = uniqueness.

Remediation metrics: no regulator benchmarks. McKinsey: 20% more KYC automation cut outreaches per case 18% and raised throughput 48%; one bank cut customer contacts ~40%. https://www.mckinsey.com/business-functions/risk-and-resilience/our-insights/five-actions-to-build-next-generation-know-your-customer-capabilities — Suggested KPI set (design default): contact rate, response rate, cure rate, time-to-cure, re-fallout rate (12 months), escalation rate, complaints per 1,000 contacts.

## 5. Email and document intake automation

MRZ check digits: ICAO 9303 weights 7-3-1 modulo 10. https://scanbot.io/blog/what-is-a-check-digit — Validity checks per GPG 45 (above). EBA remote onboarding (above).

Human-in-the-loop thresholds (vendor guidance, to be calibrated): identity fields 0.90–0.95; financial fields 0.95–0.98; compliance fields 0.97–0.99 or mandatory review; random audit of 5% of auto-approved documents; log "what changed, who changed it, when, and why"; leaked-error target < 0.5%. https://parseur.com/blog/hitl-best-practices

Audit and retention: FATF R.11 ≥ 5 years; CBUAE 6.1.6.1 ≥ 5 years, 5.2.5.7 collection communications 5 years; SAMA call recordings ≥ 10 years. Audit record content (NIST SP 800-53 AU-3): event type, when, where, source, outcome, identity. https://www.tarleton.edu/security-controls-catalog/audit-and-accountability-au/au-3-content-of-audit-records/ — ISO 27001:2022 A.8.15: log activities, privileged actions, exceptions, configuration changes; separate access-controlled log store. https://www.tcsa.in/frameworks/iso-27001/controls/8-15-logging

Inbound email practice: UAE banks accepted ID copies by SMS, e-mail or RM (2019); CBQ routes documents through in-app secure mail. An emailed document is lower-assurance evidence than an in-app capture with liveness and should require human verification before the record changes.

## 6. Segment-based service models

Published GCC thresholds: QNB First — salary ≥ QAR 35,000 or ADB ≥ QAR 350,000; QNB First Plus — salary ≥ QAR 100,000 or ADB ≥ QAR 4m; Private by invitation. https://qnb.com/sites/qnb/qnbqatar/page/en/enaboutliferewards.html — QIB Private Banking: relationship value not published; by invitation or referral. https://www.qib.com.qa/en/personal/accounts/tiers/private-banking — Emirates NBD Private: USD 5m AUM. https://www.emiratesnbd.com/en/priority-banking — Mashreq Gold: salary ≥ AED 80,000 or balance AED 500,000. https://mashreq.com/en/uae/gold/become-a-customer — ADCB Privilege: net salary ≥ AED 40,000 or balance ≥ AED 200,000. https://www.adcb.com/en/personal/adcb-for-you/segments/privilege/ — Standard Chartered Priority UAE: salary ≥ AED 30,000 or AED 370,000 funded. https://sc.com/ae/priority/eligibility-criteria/

Contact differentiation: Capgemini — HNWIs expect a dedicated RM reachable by meeting, phone, e-mail or secure messaging; ultra-HNWIs expect dedicated lines. https://www.capgemini.com/insights/research-library/wealth-advising-2024-key-trends-for-success/ — UNVERIFIED: no regulator rule routing HNWI communications via the RM; RM-first is a design default supported by the service models above.

## 7. Human-in-the-loop and agent governance

CBUAE Guidance Note on responsible AI in the financial sector (February 2026, non-binding): AI inventory; human in the loop / on the loop / out of the loop (the last only for "low-risk, non-material processes"); disclosures in Arabic and English for high-impact decisions; right to human review, challenge and correction. https://www.pinsentmasons.com/out-law/news/uae-central-bank-responsible-ai-guidance-financial-sector ; https://www.centralbank.ae/media/mykn5fue/cbuae-issues-guidance-note-to-protect-consumers-and-ensure-responsible-use-of-artificial-intelligence-in-the-financial-sector-en.pdf — EU AI Act Art. 14 (override, automation-bias awareness) and Art. 12 (automatic logging). https://artificialintelligenceact.eu/article/14/ ; https://artificialintelligenceact.eu/article/12/ — GDPR Art. 22(3). https://gdpr-info.eu/art-22-gdpr/

Separation of duties: BCBS operational-risk principles (2021) paras 50–51 on dual controls; maker-checker / four-eyes. https://www.bis.org/bcbs/publ/d515.pdf ; https://en.wikipedia.org/wiki/Maker-checker

Recommended approval matrix (design default): no approval for templated reminders within policy, contact logging, scheduling; maker-checker before writing a KYC field from a document, lifting a block, changing contact details, marking a case cured; human-in-the-loop mandatory for anything with credit effect, for any VVIP/HNWI contact, and for hardship or complaint replies. Every agent action logged with who/what/when/where/outcome/evidence.

## 8. Collections-adjacent reasons

FCA TR16/10: poor practice = refusing to change call times, payment-only focus; good practice = establishing circumstances. https://www.fca.org.uk/publication/impact-assessments/early-arrears-management-in-unsecured-lending-tr16-10.pdf — Fair4All example cadence: pre-due nudge; day 1 text and e-mail; day 4 reminder; day 7 first call; day 10 letter; one action per day; non-threatening language. — CONC 6.7.2R: monitor repayment record and act on signs of difficulty. https://handbook.fca.org.uk/handbook/conc6/conc6s7 — CBUAE 5.1.2.10: monitor borrowers facing difficulty. https://rulebook.centralbank.ae/en/entiresection/44 — Self-cure statistics: UNVERIFIED.

No offers to customers in arrears: CONC 6.7.7R (no limit increase where at risk of financial difficulty); CONC 5.2A.22G; CCD2 Arts. 17–18, 35; CBUAE 7.1.2.3 and 7.1.3.5(e); 5.1.1.10. Design rule: suppress pre-approved offers for DPD > 0, returned cheque in the last 12 months, DBR breach, or an open hardship flag; the thresholds are design defaults.

## Recommended default parameters for the outreach policy (per segment)

Applies to service/regulatory outreach (document refresh, data correction). Offer-related contact is additionally gated by opt-in status.

| Parameter | Mass | High Value | HNWI | VVIP | Source / basis |
|---|---|---|---|---|---|
| Max contacts per week (all channels, per customer) | 3 | 2 | 1 (RM-initiated) | 1 per 2 weeks, RM only | ACCC/ASIC 3 calls/week; SAMA ≤ 10 attempts/30 days; Reg F 7-in-7 upper bound; step-downs design default |
| Max per day | 1 | 1 | 1 | 1 | Fair4All "not more than once a day"; US state 3/24h caps |
| Max reminders per request | 3 before due + 3 after, incl. one letter/registered channel | 3 total, then RM | 2 digital, then RM | 1 courtesy notice, then RM | RBI ≥ 3 + ≥ 3 incl. letter; CBUAE written notices over 90 days; variants design default |
| Days between reminders | 30 (T-90, T-60, T-30), then 30, 30; block at T+90 | 30 | 14, then RM | RM discretion | CBUAE 90 days before card block; SAMA ≥ 30 days before freeze; intervals design default |
| Contact window (local) | 09:00–20:00 service; 09:00–18:00 for any call carrying an offer | same | 09:00–18:00 RM hours | agreed with client | CBUAE 9 AM–8 PM; UAE Cabinet Res. 56/2024 9–6; CRA Qatar no marketing 21:00–09:00 |
| Channels allowed | App push, SMS, e-mail, WhatsApp (opt-in, templates), call after digital attempts | App push, e-mail, WhatsApp (opt-in), RM call | RM call, secure in-app message, e-mail; no bulk SMS | RM call/meeting; letter; no automated messages | CBUAE approved methods; WhatsApp policy; SAMA channel list; HNWI/VVIP limits design default |
| Escalate to human after N unanswered automated attempts | 3 | 2 | 0 (RM first) | 0 (RM only) | design default; CBUAE AI note allows out-of-loop only for low-risk steps |
| Quiet days / periods | Friday 11:30–14:00, public holidays, Eid; Ramadan 10:00–16:00, none 1h around iftar | same | same | same | ASIC/CBUAE draft on holidays; Ramadan windows design default — UNVERIFIED |
| Opt-out handling | Marketing opt-out within 10 business days (TCPA) / 2 business days (CRA Qatar); service messages continue via one neutral channel | same | same | same | TCPA; CRA Art. 6(3); CBUAE opt-out default; ICO service vs marketing |
| Restriction after non-response (expired ID) | T+90 temporary card block, branch operations allowed, no fee; hard block after a further notice | same, RM informed | RM confirms before any block | RM/segment head approval | CBUAE 6.2.1.5; RBI partial-then-full freeze |
| Offer suppression | No offer if DPD > 0, returned cheque in 12 months, DBR breach, hardship flag, opted out | same | same | same | CONC 6.7.7R; CBUAE 7.1.2.3, 7.1.3.5(e); CCD2 Art. 17; 12-month lookback design default |
| Record retention of outreach | 5 years after settlement/relationship end (10 years for call recordings under SAMA; 10 years for KYC under Qatar AML law) | same | same | same | CBUAE 5.2.5.7, 6.1.6.1; SAMA; FATF R.11; Qatar Law 20/2019 |

UNVERIFIED items (not to be stated as fact): Ramadan contact windows; HKMA cycle; any rule routing HNWI communications via the RM; pre-approval eligibility or conversion rates; early-arrears self-cure percentages.
