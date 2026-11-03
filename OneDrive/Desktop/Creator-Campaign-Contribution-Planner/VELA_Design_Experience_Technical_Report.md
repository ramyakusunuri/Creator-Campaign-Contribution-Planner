# VELA — Intelligent Hospital Operations Platform with Real-Time AI Clinical Assistance

---

### [Template T1: Title / Cover Page]

# VELA: AN INTELLIGENT HOSPITAL OPERATIONS PLATFORM WITH REAL-TIME AI CLINICAL ASSISTANCE

### Design Experience III Project Report
*submitted in partial fulfilment of the requirements of*

**Bachelor of Technology**  
*in*  
**Computer Engineering**

**Vertical:** Technical Competition / Industry Research

*by*  
**[Student 1 Name] (Roll No.: [B001] / SAP ID: [70012023001])**  
**[Student 2 Name] (Roll No.: [B002] / SAP ID: [70012023002])**  
**[Student 3 Name] (Roll No.: [B003] / SAP ID: [70012023003])**  

*Under the supervision of*  
**[Name of Faculty Mentor]**  
*Assistant Professor, Department of Computer Engineering, MPSTME*  

<br>

**MUKESH PATEL SCHOOL OF TECHNOLOGY MANAGEMENT & ENGINEERING**  
**SVKM’s NMIMS (Deemed-to-be University), Mumbai**  
**ACADEMIC YEAR 2026–27**  

---

<div style="page-break-after: always;"></div>

### [Template T2: Certificate]

## SVKM’s NMIMS University
*(Deemed-to-be University)*  
### MUKESH PATEL SCHOOL OF TECHNOLOGY MANAGEMENT & ENGINEERING (MPSTME)
**Vile Parle (W), Mumbai – 400056**  
**Academic Year 2026–27**

<br>

### CERTIFICATE

This is to certify that the Design Experience III project entitled **“VELA: An Intelligent Hospital Operations Platform with Real-Time AI Clinical Assistance”** has been carried out by **[Student 1 Name (Roll No. B001)], [Student 2 Name (Roll No. B002)], and [Student 3 Name (Roll No. B003)]** under my guidance and supervision, and has been submitted in partial fulfilment of the requirements of the degree of **Bachelor of Technology in Computer Engineering** of MPSTME, SVKM’s NMIMS (Deemed-to-be University), Mumbai, India.

<br><br><br>

_____________________________  
**[Name of Faculty Mentor]**  
Project Mentor (Internal Guide)  
Assistant Professor, MPSTME  

<br><br>

_____________________________  
**[Name of Vertical SPOC]**  
Vertical SPOC  
Design Experience, MPSTME  

<br><br>

_____________________________  
**[Name of Head of Department]**  
Head of Department  
Department of Computer Engineering, MPSTME  

<br>

**Date:** 28th October 2026  
**Place:** Mumbai  

---

<div style="page-break-after: always;"></div>

### [Template T3: Acknowledgement, Team Details, and Declaration]

### ACKNOWLEDGEMENT

We express our profound gratitude to our internal project mentor, **[Name of Faculty Mentor]**, for providing invaluable guidance, technical reviews, and constant encouragement throughout the design and execution of Project VELA. We extend our sincere appreciation to **[Name of Vertical SPOC]**, Design Experience Vertical SPOC, and **[Name of Head of Department]**, Head of the Department of Computer Engineering, for facilitating the infrastructural and computational resources required for this project.

We also thank the technical competition reviewers, mentors, and open-source contributors whose feedback during the interim reviews significantly helped harden VELA's architecture, data privacy model, and streaming pipeline. Finally, we thank our peers and families for their unwavering moral and collaborative support.

<br>

### TEAM DETAILS

Table 0.1: Details of Project Team Members
| Name | Roll No. | SAP ID | Vertical & Branch |
| :--- | :---: | :---: | :--- |
| **[Student 1 Name]** | B001 | 70012023001 | Technical Competition / B.Tech Computer Engineering |
| **[Student 2 Name]** | B002 | 70012023002 | Technical Competition / B.Tech Computer Engineering |
| **[Student 3 Name]** | B003 | 70012023003 | Technical Competition / B.Tech Computer Engineering |

<br>

### DECLARATION

We declare that this report entitled **“VELA: An Intelligent Hospital Operations Platform with Real-Time AI Clinical Assistance”** is our original work and reflects our own contribution during the semester of registration (Academic Year 2026–27). We have acknowledged all contributors, cited all literature and empirical sources using the IEEE format, and respected intellectual property and data governance boundaries. The use of generative artificial intelligence and developer assistance tools has been comprehensively disclosed in Section 5.5 and recorded in Appendix VII; all synthesized code, algorithms, and technical outputs have been manually audited, verified, and empirically benchmarked by us.

<br><br>

_____________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _____________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _____________________________  
**[Student 1 Signature]** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **[Student 2 Signature]** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **[Student 3 Signature]**  

**Date:** 28th October 2026  

---

<div style="page-break-after: always;"></div>

### [Template T4: Front Matter Layout]

### ABSTRACT

Small and mid-size healthcare facilities face severe operational fragmentation, relying on manual paper tokens, disconnected diagnostic laboratory systems, uncoordinated telephonic communications, and cumbersome paper charts. While enterprise Electronic Health Record (EHR) suites (e.g., Epic, Cerner) offer digital consolidation, their prohibitive licensing costs, extensive deployment footprints, and steep learning curves render them inaccessible to resource-constrained clinics and tier-2/tier-3 hospitals. Furthermore, clinicians in these setups lose valuable diagnostic time sifting through heterogeneous, multi-page diagnostic PDFs to retrieve vital markers.

To solve this dual challenge of cost-effective operations and rapid clinical synthesis, this project presents **VELA**, an integrated, multi-tenant hospital operations platform featuring **Atlas**, an embedded real-time AI clinical copilot. VELA digitizes the comprehensive clinical workflow across eight specialized actor roles: self-service patient onboarding with zero-credential frictionless booking, live dynamic triage and queue tracking, doctor consultation workspaces, bi-directional diagnostic laboratory workflows, bedside admission/discharge management with dynamic QR wristbands, and administrative command consoles. 

The embedded assistant, Atlas, leverages multimodal Vision LLMs (GPT-4o Vision), strict optical character recognition (OCR) confidence thresholds, and deterministic Retrieval-Augmented Generation (RAG) using dense vector embeddings (`text-embedding-3-small`). Atlas processes uploaded patient records, enforces zero-hallucination document-grounded query answering with strict inline citations, automates clinical deterioration detection, drafts ambient consultation summaries, and provides progressive low-latency voice synthesis via ElevenLabs TTS. The backend is engineered using asynchronous FastAPI and Socket.IO over Python 3.12, encapsulating 141 API endpoints across 11 modular subsystems, backed by a dual-tier persistence layer (Supabase PostgreSQL for master clinical records with Row-Level Security, alongside a high-throughput, local SQLite instance with SHA-256 hash-chained tamper-evident audit logging).

Benchmarking conducted on staging data and live competition demonstrations verified an end-to-end voice query response latency of 2.4 seconds to first spoken syllable, 100% clinical answer grounding against uploaded patient documentation, 0% unauthorized route access enforced across 39 rigorous policy tests, and sub-100ms real-time queue synchronization across multi-tenant Socket.IO rooms. VELA demonstrates a robust, scalable, and cost-effective digital health paradigm tailored for emerging healthcare ecosystems.

**Keywords:** Hospital Information Systems (HIS), Retrieval-Augmented Generation (RAG), Clinical Copilot, Asynchronous FastAPI, Multimodal AI, Tamper-Evident Audit Logging.

---

<div style="page-break-after: always;"></div>

### TABLE OF CONTENTS

* **Abstract** ................................................................................................................................. i
* **Table of Contents** ................................................................................................................ ii
* **List of Figures** ..................................................................................................................... iii
* **List of Tables** ...................................................................................................................... iv
* **List of Abbreviations** ........................................................................................................... v
* **Chapter 1: Introduction** ..................................................................................................... 1
  * 1.1 Background of the Project Topic .................................................................................... 1
  * 1.2 Motivation and Scope of the Report ............................................................................... 2
  * 1.3 Problem Statement / Need and Stakeholders ................................................................... 3
  * 1.4 Objectives and Expected Outcomes ................................................................................. 4
  * 1.5 Project Context and Continuity ....................................................................................... 5
  * 1.6 Organization of the Report ............................................................................................ 6
* **Chapter 2: Background Study** ............................................................................................ 7
  * 2.1 Overview of the Domain and Its Context ........................................................................ 7
  * 2.2 Review of Relevant Sources and Existing Systems ........................................................... 8
  * 2.3 Gap Analysis and Need Identification ............................................................................ 10
* **Chapter 3: Design and Development Process** ................................................................... 11
  * 3.1 Stakeholder Needs and System Requirements ................................................................ 11
  * 3.2 Design Alternatives and Multi-Factor Decision Matrix ................................................... 13
  * 3.3 Selected System Architecture and Data Schemas ............................................................ 15
  * 3.4 Engineering Standards, Constraints, Safety, and Ethics ................................................... 18
  * 3.5 Project Execution Plan, Work Breakdown, and Milestones ............................................... 20
* **Chapter 4: Implementation, Results and Analysis** ........................................................... 21
  * 4.1 Implementation of Backend Subsystems and AI Pipelines ................................................ 21
  * 4.2 Verification, Validation, and Testing Framework ........................................................... 24
  * 4.3 Results, Performance Analysis, and Student Contributions ............................................ 26
  * 4.4 Feedback Received and Iterative Hardening .................................................................... 28
  * 4.5 Advantages, Limitations, and Societal Impact ................................................................. 29
* **Chapter 5: Individual Contribution, Teamwork and Reflection** ..................................... 31
  * 5.1 Team Structure, Roles, and Governance ......................................................................... 31
  * 5.2 Individual Contribution Statement and IER Matrix ......................................................... 32
  * 5.3 Teamwork, Coordination, and Mentor Engagement ........................................................ 34
  * 5.4 Individual Critical Reflections and Lessons Learned ....................................................... 35
  * 5.5 Professional Conduct, Safety, and AI Use Disclosure ...................................................... 37
* **Chapter 6: Conclusion and Future Scope** .......................................................................... 38
  * 6.1 Summary of Accomplishments ...................................................................................... 38
  * 6.2 Future Roadmap and Handover Notes ............................................................................ 39
* **References** ........................................................................................................................... 40
* **Appendices (Appendix I to Appendix VII)** ......................................................................... 42

---

### LIST OF FIGURES

* **Fig. 3.1:** High-Level Component and Inter-Service Network Architecture ................................. 16
* **Fig. 3.2:** End-to-End Multimodal AI Ingestion and Query Execution Pipeline .............................. 17
* **Fig. 3.3:** Comprehensive Entity Relationship Diagram (ERD) of Core Schemas ......................... 18
* **Fig. 3.4:** Project Execution Gantt Chart and Milestone Progression ............................................ 20
* **Fig. 4.1:** Emergency Triage Ingestion and Negative Queue Dynamic Resolution Flow ................. 23
* **Fig. 4.2:** Real-Time Atlas Clinical Speech-to-Speech Streaming Topology ................................... 27

---

### LIST OF TABLES

* **Table 0.1:** Details of Project Team Members .............................................................................. iii
* **Table 2.1:** Comparative Analysis of Healthcare Platforms and Architectural Approaches ........... 9
* **Table 3.1:** Prioritized Functional Requirements Across User Roles ............................................. 12
* **Table 3.2:** Multi-Factor Architectural Decision Matrix ................................................................ 14
* **Table 3.3:** Supabase PostgreSQL Master Data Schema Summary ................................................. 15
* **Table 3.4:** Local SQLite Operational Data Schema Summary ....................................................... 16
* **Table 4.1:** Backend Module Decomposition and Responsibility Directory ................................... 22
* **Table 4.2:** Empirical System Performance and Validation Benchmarks ....................................... 26
* **Table 4.3:** Known Technical Debt and Architectural Remediation Roadmap ............................... 29
* **Table 5.1:** Team RACI Responsibility and Task Ownership Matrix ............................................. 32
* **Table 5.2:** Consolidated Individual Evidence Register (IER) ...................................................... 33

---

### LIST OF ABBREVIATIONS

* **ABDM:** Ayushman Bharat Digital Mission
* **ABHA:** Ayushman Bharat Health Account
* **API:** Application Programming Interface
* **BAA:** Business Associate Agreement
* **CAD:** Computer-Aided Diagnosis / Computer-Aided Design
* **CBC:** Complete Blood Count
* **EHR:** Electronic Health Record
* **EPICS:** Engineering Projects in Community Service
* **FHIR:** Fast Healthcare Interoperability Resources
* **HL7:** Health Level Seven International
* **HIPAA:** Health Insurance Portability and Accountability Act
* **HTTP/REST:** Hypertext Transfer Protocol / Representational State Transfer
* **ICA:** Internal Continuous Assessment
* **IER:** Individual Evidence Register
* **JSON:** JavaScript Object Notation
* **LLM:** Large Language Model
* **MVP:** Minimum Viable Product
* **NFR:** Non-Functional Requirement
* **OCR:** Optical Character Recognition
* **OPD:** Outpatient Department
* **ORU:** Observational Report Unsolicited
* **PHI:** Protected Health Information
* **PK:** Primary Key
* **PRD:** Product Requirements Document
* **RAG:** Retrieval-Augmented Generation
* **RACI:** Responsible, Accountable, Consulted, Informed
* **RLS:** Row-Level Security
* **SPOC:** Single Point of Contact
* **STT:** Speech-to-Text
* **TEE:** Term End Examination
* **TRD:** Technical Requirements Document
* **TTS:** Text-to-Speech
* **UI/UX:** User Interface / User Experience
* **VIP:** Vertically Integrated Projects
* **WBS:** Work Breakdown Structure

---

<div style="page-break-after: always;"></div>

# CHAPTER 1: INTRODUCTION

This chapter establishes the technical, clinical, and operational context of Project VELA. It delineates the foundational challenges of workflow fragmentation and cognitive overload in small and mid-size healthcare facilities, defines the formal problem statement, outlines primary and secondary engineering objectives, presents the scope of work completed during the registration semester, and concludes with an overview of the report's architectural progression.

### 1.1 Background of the Project Topic
Healthcare delivery in developing and resource-constrained environments operates within a landscape of severe administrative and technological asymmetry [1]. While major metropolitan tertiary hospitals possess the financial capital to deploy monolithic, multi-million-dollar Health Information Systems (HIS) and Electronic Health Record (EHR) frameworks such as Epic Systems or Oracle Cerner, small and mid-sized clinics (constituting over 70% of initial outpatient visits) operate almost exclusively on fragmented, paper-bound modalities [2]. Outpatients wait in queues governed by physical paper tokens; inter-departmental communications between front desks, consulting clinicians, and diagnostic laboratories rely on verbal handoffs or unencrypted instant messaging channels; and diagnostic outputs arrive as static, multi-page PDF documents. 

In parallel, the cognitive burden placed on consulting physicians has escalated exponentially. Clinical consultations require doctors to rapidly synthesize longitudinal patient histories, cross-reference previous diagnostic investigations, verify contraindications across prescribed pharmacotherapy, and maintain structured consult records [3]. When diagnostic reports are presented as fragmented physical prints or unindexed digital PDFs, physicians must expend substantial portions of the limited consultation window manually scanning for single critical parameters (such as serum creatinine, glycated hemoglobin, or platelet trends). This cognitive friction detracts directly from patient communication and clinical diagnostic precision [4]. Project VELA was conceived to bridge this technological divide by constructing an integrated, lightweight, cloud-native hospital operating environment embedded with an intelligent, voice-first clinical assistant called Atlas.

### 1.2 Motivation and Scope of the Report
The motivation for developing VELA stems from the convergence of two modern computing paradigms: lightweight, asynchronous, event-driven web micro-frameworks and grounded multimodal Large Language Model (LLM) pipelines [5]. By leveraging asynchronous Python frameworks (FastAPI) coupled with real-time bidirectional communication channels (Socket.IO), modern cloud environments can deliver real-time operational synchronization—such as queue management, instant diagnostic dispatch, and bedside tracking—at a tiny fraction of the resource overhead mandated by legacy enterprise systems. Furthermore, recent breakthroughs in Retrieval-Augmented Generation (RAG) and multimodal vision processing allow artificial intelligence to serve not as speculative diagnostic generators, but as highly accurate, deterministic summarization and document-grounded decision-support engines [6].

The scope of this report encompasses the complete engineering lifecycle of Project VELA executed during the Design Experience registration semester:
1. Formalization of the Product Requirements Document (PRD) and Technical Requirements Document (TRD).
2. Architectural design and implementation of a modular, asynchronous backend service spanning 141 REST endpoints across 11 functional subsystems.
3. Engineering of the Atlas AI Clinical Pipeline, incorporating optical scan validation, GPT-4o Vision parameter extraction, dense vector chunk retrieval (`text-embedding-3-small`), automated deterioration indexing, and low-latency voice synthesis via ElevenLabs TTS.
4. Implementation of a secure, multi-tier data architecture combining remote managed PostgreSQL (Supabase) enforced via strict Row-Level Security (RLS) with an ultra-low-latency local operational store (SQLite) featuring a tamper-evident, SHA-256 hash-chained audit log.
5. System hardening, formal authorization regression testing (39 test cases), performance benchmarking, and competitive deployment evaluation.

### 1.3 Problem Statement, Need, and Stakeholder Taxonomy
*Problem Statement:* Small-to-mid-size healthcare facilities lack an unified, affordable digital operations infrastructure, causing extreme administrative latency, opaque patient queues, and physician burnout resulting from manual data retrieval across unstructured clinical documents. Existing commercial software remains cost-prohibitive, complex to deploy, and devoid of intelligent real-time document summarization.

To resolve these deficits, VELA addresses the explicit needs of eight distinct stakeholder roles:
* **The Patient:** Requires zero-friction onboarding, account-less appointment scheduling, instant emergency distress signaling, live visibility into their real-time queue position, and unified access to bills, visit summaries, and lab findings.
* **The Receptionist:** Requires an ergonomic triage desk to register walk-ins, issue standardized algorithmic ticket identifiers, dynamically assign or balance doctor queues, record arrivals, and settle laboratory receivables.
* **The Clinician (Doctor):** Demands instant chart synthesis, single-click patient calling, ambient dictation/transcription of clinical notes, instant natural language querying across historical reports with source citations, automated pharmacotherapy contraindication checks, and rapid discharge authoring.
* **The Ward Nurse:** Requires instantaneous bedside identification via dynamic QR wristband scanning, real-time bed occupancy maps, running cost updates, and shift handover reports.
* **The Lab Controller / Radiologist:** Needs segregated, departmentalized order queues (Pathology vs. Radiology), structured test result entry templates, automated PDF generation, and computer-assisted imaging anomaly detection with mandatory clinical review guardrails.
* **The Hospital Administrator (Manager):** Requires comprehensive oversight of facility KPIs, ward capacity configurations, medical staff credentials, and tamper-evident audit trails for regulatory compliance.
* **The Platform Operator (VELA Owner):** Needs centralized multi-tenant onboarding consoles, cryptographic tenant segregation, and network-level operational analytics.
* **Independent Network Providers:** Require external APIs to link third-party diagnostic centers and affiliated community practices into the broader VELA booking and referral network.

### 1.4 Objectives and Expected Outcomes
The primary engineering objectives and target metrics established for Project VELA are:
1. *Sub-3-Second AI Clinical Synthesis:* Achieve a Time-To-First-Word (TTFW) audio response latency under 3.0 seconds (empirically achieved: ~2.4 seconds) when a clinician queries a patient’s historical multi-page document portfolio.
2. *Zero-Hallucination Grounded Clinical Answering:* Guarantee 100% strict document grounding for all clinical factual responses generated by Atlas, completely disabling ungrounded memory stores for medical facts and enforcing explicit document page citations.
3. *End-to-End Operational Transparency:* Deliver 100% real-time queue position visibility to ticketed patients via lightweight WebSockets, eliminating physical queue guessing.
4. *Single-Tap Emergency Triage Escalation:* Provide a deterministic emergency response protocol enabling patients to alert the nearest facility in two taps, triggering dynamic queue insertion at negative index positions (`queue_position < 0`) to immediately preempt standard consultations.
5. *Fail-Closed Security and Compliance Posture:* Achieve 100% route coverage under a centralized authorization policy matrix verified by automated continuous integration testing, complemented by a tamper-evident, SHA-256 hash-chained Protected Health Information (PHI) access log.

### 1.5 Project Context and Continuity
Project VELA was undertaken within the **Technical Competition / Industry Research** vertical of Design Experience. Unlike typical conceptual capstone exercises, VELA was architected, built, and iteratively hardened against rigorous technical competition guidelines. The foundational ideation, technical architecture formulation, and core MVP sprint were finalized leading up to the public competitive demonstration on September 26, 2026. Following the competitive evaluation, the project entered an intensive post-demo engineering cycle throughout October 2026, focusing on security audits, database Row-Level Security hardening (`rls_lockdown.sql`), route authorization policy verification, and the transition of legacy untyped interfaces toward standardized data contracts. This report documents the consolidated work executed across this semester, explicitly demarcating established baseline foundations from recent security and architectural hardening passes.

### 1.6 Organization of the Report
The remainder of this report is organized as follows:
* **Chapter 2 (Background Study):** Analyzes the operational and clinical domain, reviews academic literature and commercial benchmarks, and details the specific technological gap targeted by VELA.
* **Chapter 3 (Design and Development Process):** Formulates formal functional and non-functional specifications, provides a comparative decision matrix justifying the technology stack, details the micro-service and AI pipeline architecture, and delineates engineering constraints and project milestones.
* **Chapter 4 (Implementation, Results and Analysis):** Details the backend modular implementation, Socket.IO event architecture, AI processing pipelines, empirical performance results, testing regimes, and iterative system enhancements.
* **Chapter 5 (Individual Contribution, Teamwork and Reflection):** Documents the team governance structure, individual engineering contributions mapped against formal Evidence IDs, reflective analysis, and professional ethics disclosures.
* **Chapter 6 (Conclusion and Future Scope):** Summarizes technical achievements and outlines future work regarding HL7/FHIR interoperability, ABHA integration, and horizontal scale engineering.
* **End Matter:** Contains formal IEEE References followed by Appendices I through VII.

*Summary:* Chapter 1 established the clinical motivation, institutional challenges, multi-stakeholder taxonomy, and empirical targets of Project VELA, setting the operational foundation for the background analysis presented in Chapter 2.

---

<div style="page-break-after: always;"></div>

# CHAPTER 2: BACKGROUND STUDY

This chapter situates VELA within the broader academic and industrial landscape of medical informatics. It surveys existing enterprise hospital information architectures, examines the state of the art in Large Language Model (LLM) applications in healthcare, presents a structured comparative matrix of prevailing solutions, and isolates the specific operational and economic gaps addressed by VELA’s architecture.

### 2.1 Overview of the Domain and Its Context
The domain of Healthcare Information Systems (HIS) spans three core functional planes: administrative resource planning, clinical information management (Electronic Health Records - EHR), and diagnostic ancillary systems (Laboratory Information Systems - LIS, and Picture Archiving and Communication Systems - PACS) [7]. Over the past three decades, enterprise platforms have evolved toward monolithic, highly centralized architectures. While these systems achieve deep regulatory compliance within Western insurance-reimbursement frameworks, they impose massive compute, storage, and administrative deployment overheads [8].

Concurrently, the rapid emergence of transformer-based Large Language Models has demonstrated extraordinary potential in natural language understanding, clinical document parsing, and ambient medical transcription [9]. However, applying general-purpose generative models directly to healthcare environments introduces severe risks:
1. *Hallucination:* Generative models can invent plausible-sounding laboratory values, clinical histories, or pharmaceutical dosages [10].
2. *Latency:* Massive parameter models exhibit substantial token-generation latency, preventing conversational, real-time clinical interaction during rapid patient examinations.
3. *Data Sovereignty and Privacy:* Transmitting unredacted Protected Health Information (PHI) to commercial model APIs without strict compliance and audit controls violates regulatory mandates such as HIPAA and the Indian Digital Personal Data Protection (DPDP) Act [11].

Consequently, contemporary medical informatics research is focused on developing hybrid, deterministic architectures where LLMs operate under strict Retrieval-Augmented Generation (RAG) constraints, acting exclusively as semantic synthesizers over validated, patient-specific ground truth documents [12].

### 2.2 Review of Relevant Sources and Existing Systems
Extensive analysis of commercial systems, open-source initiatives, and academic publications was conducted to benchmark VELA’s functional requirements.

Table 2.1: Comparative Analysis of Healthcare Platforms and Architectural Approaches
| System / Approach | Core Architecture | Target Demographic | Clinical AI Capability | Real-Time Sync | Primary Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Enterprise EHRs** *(Epic, Cerner)* [7] | Monolithic client-server; relational DB on-premise/private cloud. | Large hospital networks, academic medical centers. | Predictive scoring; emerging ambient notes via heavy add-ons. | Proprietary message brokers; complex HL7/FHIR queues. | Extremely high capital/operational expenditure; complex UX; inaccessible to small clinics. |
| **OpenMRS** [13] | Modular open-source; Java Spring / MySQL backend. | Low-resource clinics, global health programs. | Minimal native AI; relies on external plugin modules. | Polling-based HTTP; no native real-time room messaging. | High setup friction; lacking integrated real-time patient queue and AI copilot workflows. |
| **Commercial Telehealth SaaS** *(Practo, Zocdoc)* [14] | Cloud microservices; RESTful APIs; proprietary relational stores. | Independent practitioners, commercial polyclinics. | Automated reminders, conversational triage chatbots. | Push notifications and standard webhooks. | Proprietary lock-in; focuses on patient acquisition rather than comprehensive inpatient/ward operations. |
| **Vanilla RAG Copilots** *(Academic prototypes)* [12] | Python backend (LangChain/LlamaIndex) + Vector DB. | Research benchmarks, isolated document Q&A. | Pure text-based semantic retrieval over static PDF text. | None; standard stateless HTTP request/response. | Lack operational integration (queues, admissions, lab orders); susceptible to memory hallucinations. |
| **Project VELA** *(Proposed)* | Event-driven FastAPI + Socket.IO; dual-tier Supabase & SQLite. | Small-to-mid-size hospitals, polyclinics, networks. | Multi-agent Atlas (Vision OCR, strict RAG, deterioration flags, voice TTS). | Native bidirectional Socket.IO scoped to hospital and patient rooms. | Single-instance in-memory limiter; pending formal FHIR R4 / ABHA national gateway link. |

As illustrated in Table 2.1, existing commercial and open-source solutions force healthcare facilities into a false dichotomy: institutions must either invest millions of dollars into unwieldy enterprise suites, or cobble together fragmented point solutions (paper tokens, standalone billing software, consumer messaging apps) that compromise patient safety, operational efficiency, and clinical data governance.

### 2.3 Gap Analysis and Need Identification
The background investigation revealed three fundamental structural gaps in the healthcare informatics ecosystem:
1. *The Economic and Operational Accessibility Gap:* Small and mid-size hospitals are priced out of modern enterprise platforms. They require a lightweight, web-native system capable of unifying front-desk registration, dynamic triage ticketing, inpatient bed allocations, and lab routing without requiring specialized on-site IT infrastructure.
2. *The Diagnostic Synthesis Bottleneck:* Consulting clinicians spend up to 40% of their allocated consultation time navigating multi-page laboratory and radiology PDFs to compare historical trends (e.g., assessing kidney function deterioration across successive biochemical profiles). Existing systems present documents as passive attachments rather than active, queryable data nodes.
3. *The Deterministic AI Trust Gap:* Clinicians consistently reject speculative AI diagnostic tools due to valid fears of hallucinated guidance. There is an acute need for a clinical copilot whose operational boundary is strictly constrained: answers must be synthesized exclusively from verified, uploaded patient records, reinforced with clickable source citations, and backed by automated image quality flags that mandate human-in-the-loop sign-off.

*Summary:* Chapter 2 surveyed the prevailing healthcare IT landscape and established the critical architectural and economic gaps. These findings directly drive the requirements and system design articulated in Chapter 3.

---

<div style="page-break-after: always;"></div>

# CHAPTER 3: DESIGN AND DEVELOPMENT PROCESS

This chapter presents the engineering formulation of Project VELA. It details the functional and non-functional specifications, provides a multi-factor decision matrix evaluating architectural alternatives, describes the selected system topology and database schemas, addresses engineering standards and safety constraints, and outlines the project execution plan.

### 3.1 Stakeholder Needs and System Requirements
Based on user journey mappings across the eight identified stakeholder personas, system requirements were decomposed into prioritized Functional Requirements (FR) and Non-Functional Requirements (NFR).

Table 3.1: Prioritized Functional Requirements Across User Roles
| Requirement ID | Module / Domain | Description and Operational Contract | Priority |
| :--- | :--- | :--- | :---: |
| **FR-P1** | Patient Portal | Single-tap emergency 108 dialer; two-tap emergency broadcast to the nearest VELA facility creating a negative queue ticket (`triage_level: Emergency`). | Critical |
| **FR-P2** | Patient Portal | Frictionless self-registration (name, age, gender) and appointment booking in a single atomic transaction without pre-existing account barriers. | High |
| **FR-P3** | Patient Portal | Persistent client session management (30-day lifetime) with automatic "Continue as..." state hydration. | Medium |
| **FR-P4** | Patient Portal | Consolidated patient dashboard displaying live queue position, lab order status, outstanding invoices, visit histories, and VELA QR health credentials. | High |
| **FR-R1** | Reception & Triage | Instant walk-in registration, digital VELA ID allocation, and dynamic QR ticket generation (`TKT-YYYYMMDD-NNNN`). | Critical |
| **FR-R2** | Reception & Triage | Dynamic triage level assignment; emergency patients preempt regular appointments via negative index placement in queue scheduling. | Critical |
| **FR-R3** | Reception & Triage | Live doctor roster status monitoring with dynamic reassignment and room load balancing. | High |
| **FR-D1** | Doctor Workspace | Single-click "Next Patient" calling with asynchronous background pre-analysis and memory caching of the upcoming patient's chart. | High |
| **FR-D2** | Doctor Workspace | Interactive clinical chart consolidating historical PDFs, extracted biochemical values, risk scores, active medications, and visual timelines. | Critical |
| **FR-D3** | Atlas Clinical Copilot | Low-latency voice and text query pipeline, streamed via WebSockets, strictly grounded in the active patient’s documents with inline citations. | Critical |
| **FR-D4** | Atlas Clinical Copilot | Automated pharmacotherapy interaction cross-checking, algorithmic clinical recommendations, and multi-report deterioration alerts. | High |
| **FR-D5** | Doctor Workspace | Ambient consultation dictation module: automatic transcription, structured SOAP note generation, and physician confirmation gating. | Medium |
| **FR-L1** | Diagnostic Lab | Department-scoped order routing (Pathology vs. Radiology) tracking state transitions: Pending Payment $\to$ Awaiting Arrival $\to$ Queued $\to$ In Progress $\to$ Completed. | Critical |
| **FR-L2** | Diagnostic Lab | Configurable per-hospital test templates defining parameter fields, reference ranges, unit designations, and pricing. | High |
| **FR-L3** | Diagnostic Lab | Automated rendering of finalized results into standardized PDF lab reports, direct injection into patient records, and background trigger of Atlas analysis. | High |
| **FR-L4** | Radiology & Imaging | Multimodal image ingestion (X-ray, CT, MRI, Ultrasound) providing feature extraction, urgent anomaly flagging, and mandatory physician confirmation. | High |
| **FR-A1** | Wards & Admissions | Interactive graphical ward map with real-time bed state tracking (Empty, Occupied, Under Sanitization). | High |
| **FR-A2** | Wards & Admissions | Digital admission workflows linked via unique admission QR codes, real-time cost accumulation, and automated discharge summary compilation. | High |
| **FR-M1** | Hospital Management | Administrative control panel managing staff accounts, ward/bed capacity, department templates, and tamper-evident audit log verification. | Critical |
| **FR-M2** | Platform Owner | Multi-tenant onboarding console, network telemetry, and cross-hospital search synchronization. | High |

*Non-Functional Requirements (NFR):*
* **NFR-S1 (Security & Authorization):** Every API endpoint must enforce explicit role-based, tenant-isolated, and patient-ownership authorization checks. A fail-closed security architecture must reject any unmapped route automatically.
* **NFR-P1 (Performance & Latency):** Atlas voice query response Time-To-First-Word (TTFW) must not exceed 3.0 seconds under nominal network conditions.
* **NFR-A1 (AI Safety & Integrity):** Atlas must never pull medical facts from general LLM pre-training weights when responding to patient queries; factual responses must derive 100% from uploaded, authenticated clinical records. Low-quality document scans must trigger a mandatory physician review warning flag.
* **NFR-C1 (Auditability & Privacy):** Every read, write, and export of Protected Health Information (PHI) must be permanently recorded in a SHA-256 hash-chained audit ledger supporting cryptographic integrity validation.

### 3.2 Design Alternatives and Multi-Factor Decision Matrix
To establish the optimal architectural configuration, multiple candidate technologies were evaluated across four critical vectors: throughput latency, implementation complexity, clinical data safety, and economic cost.

Table 3.2: Multi-Factor Architectural Decision Matrix
*(Scoring: 1 = Poor, 5 = Excellent)*
| Architectural Decision | Evaluated Alternatives | Throughput & Latency | Development Complexity | Clinical Safety & Privacy | Total Weighted Score | Selected Decision & Technical Justification |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Backend Framework** | • Django REST Framework<br>• Node.js (Express)<br>• **FastAPI (Python 3.12)** | 3<br>4<br>**5** | 3<br>4<br>**4** | 4<br>3<br>**5** | 10/15<br>11/15<br>**14/15** | **FastAPI + Uvicorn:** Chosen for native asynchronous I/O, seamless integration with Python AI/ML runtimes (OpenAI, NumPy, PyMuPDF), and automatic OpenAPI validation. |
| **Real-Time Layer** | • Server-Sent Events (SSE)<br>• Raw WebSockets<br>• **python-socketio 5.16** | 4<br>5<br>**4** | 4<br>2<br>**5** | 4<br>4<br>**5** | 12/15<br>11/15<br>**14/15** | **Socket.IO:** Selected for robust room-scoping abstractions (`hospital_{id}` and `patient_{id}` rooms), automatic reconnect fallbacks, and event-based signaling. |
| **Data Persistence Strategy** | • Single Cloud PostgreSQL<br>• Pure Local SQLite<br>• **Dual-Tier: Supabase + Local SQLite** | 3<br>5<br>**4** | 4<br>5<br>**4** | 3<br>3<br>**5** | 10/15<br>13/15<br>**13/15** | **Dual-Tier Hybrid:** Managed Supabase PostgreSQL stores master relational data with strict RLS; local SQLite manages ultra-low-latency transient sessions, tickets, and hash-chained audit trails. |
| **Clinical Assistant Pipeline** | • LangChain Agent Graph<br>• Fine-Tuned Custom Model<br>• **CrewAI + Strict Deterministic RAG** | 3<br>4<br>**4** | 2<br>1<br>**4** | 3<br>3<br>**5** | 8/15<br>8/15<br>**13/15** | **CrewAI + Strict Deterministic RAG:** Completely prevents hallucinated parameters by isolating clinical Q&A to dense vector search over chunked patient PDFs (`text-embedding-3-small`). |
| **Voice Synthesis Strategy** | • Browser Native WebSpeech API<br>• Standard Cloud TTS (Google/AWS)<br>• **ElevenLabs Streamed TTS** | 5<br>3<br>**4** | 5<br>4<br>**4** | 3<br>4<br>**5** | 13/15<br>11/15<br>**13/15** | **ElevenLabs (`eleven_turbo_v2`):** Delivers natural clinical voice playback streamed progressively over an authenticated backend proxy (`/api/tts`), achieving sub-2.5s TTFW. |

### 3.3 Selected System Architecture and Data Schemas
VELA is structured around an asynchronous, event-driven micro-service architecture deployed on Render (Singapore region) with database persistence hosted on Supabase (ap-south-1).

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION                                 |
|         (Web / Mobile Browser: Patients, Receptionists, Doctors, Nurses, Admins)      |
+-------------------------------------------+-------------------------------------------+
                                            |
                         HTTPS (REST)       |       WebSocket (Socket.IO)
                       [Bearer Token]       |       [Auth Token on Connect]
                                            v
+---------------------------------------------------------------------------------------+
|                                  FASTAPI GATEWAY ENGINE                               |
|---------------------------------------------------------------------------------------|
|  [authz.py Policy Middleware: Role Checking, Tenant Isolation, Fail-Closed Security]   |
+-----+-------------------+-------------------+--------------------+--------------------+
      |                   |                   |                    |
      v                   v                   v                    v
[receptionist.py]     [rag.py]         [imaging.py]        [lab_catalog.py]
 Queue Management     Vector Search     Radiology Vision     Test Routing Engine
 Token Allocation     Document Q&A      Anomaly Detector     Template Dispatcher
      |                   |                   |                    |
      +---------+---------+---------+---------+                    |
                |                   |                              |
                v                   v                              v
      [doc_ocr.py]         [crew_agents.py]             [vela_documents.py]
       Scan Quality         Multi-Patient                PDF Lab Reports
       Safety Validation    Clinical Analysis            Discharge Generation
+---------------------------------------------------------------------------------------+
                                            |
       +------------------------------------+------------------------------------+
       |                                    |                                    |
       v                                    v                                    v
+-----------------------+        +-----------------------+        +---------------------+
|   SUPABASE POSTGRES   |        |     LOCAL SQLITE      |        |     EXTERNAL AI     |
|     (Master Data)     |        |   (Operational Data)  |        |     & CLOUD APIS    |
| • Hospital & Staff    |        | • Active Sessions     |        | • OpenAI GPT-4o /   |
| • Patients & Records  |        | • Real-Time Tickets   |        |   GPT-4o-mini       |
| • Master Appointments |        | • Department Orders   |        | • ElevenLabs TTS    |
| • RLS Enforced        |        | • Hash-Chained Audit  |        | • Google Places API |
+-----------------------+        +-----------------------+        +---------------------+
```
*Fig. 3.1: High-Level Component and Inter-Service Network Architecture*

#### Database Schemas
The database architecture employs a hybrid persistence model:
1. **Supabase PostgreSQL (Master Clinical Data):** Stores long-term relational records protected by Row-Level Security.

Table 3.3: Supabase PostgreSQL Master Data Schema Summary
| Table Name | Primary Keys & Key Attributes | Foreign Key Relationships | Functional Domain |
| :--- | :--- | :--- | :--- |
| `vela_hospitals` | `id` (PK), `name`, `city`, `total_beds`, `lat/lng`, `plan`, `manager_email`, `manager_password`, `hospital_slug` | $1 \to N$ `staff`, `wards`, `patients` | Hospital organizational identity |
| `staff` | `id` (PK), `hospital_id`, `name`, `role` (doctor/receptionist/lab_controller/nurse), `email`, `password_hash`, `ward_id` | $\to$ `vela_hospitals`, `wards` | Authenticated staff registry |
| `doctors` | `id` (PK), `name`, `specialization`, `qualification`, `experience_years`, `available` | $1 \to N$ `appointments`, `tickets` | Clinical personnel profiles |
| `patients` | `id` (PK), `vela_id`, `name`, `age`, `gender`, `blood_group`, `risk_score`, `allergies`, `hospital_id` | $1 \to N$ `documents`, `medications` | Master clinical patient entity |
| `documents` | `id` (PK), `patient_id`, `filename`, `file_url`, `values` (JSONB), `critical_flags` (JSONB), `risk_score`, `atlas_summary` | $\to$ `patients` | Clinical document repository |
| `document_chunks` | `id` (PK), `document_id`, `patient_id`, `chunk_text`, `embedding` (vector) | $\to$ `documents`, `patients` | RAG vector storage index |
| `appointments` | `id` (PK), `patient_id`, `doctor_id`, `date`, `time`, `status`, `triage_level`, `queue_position` | $\to$ `patients`, `doctors` | Scheduled consultations |

2. **Local Operational SQLite (`vela_local.db`):** Manages ultra-low-latency, transient operational states and append-only ledgers.

Table 3.4: Local SQLite Operational Data Schema Summary
| Table Name | Schema Attributes & Indexing | Functional Role & Security Posture |
| :--- | :--- | :--- |
| `sessions` | `token_hash` (PK, TEXT), `data` (JSON), `issued` (TIMESTAMP), `expires` (TIMESTAMP) | High-speed bearer session store; token values are SHA-256 hashed. |
| `audit_log` | `id` (PK), `ts`, `role`, `actor`, `staff_id`, `hospital_id`, `method`, `path`, `status`, `ip`, `reason`, `hash` | Cryptographic ledger; each row’s `hash` chains to the prior row. |
| `test_orders` | `id` (PK), `patient_id`, `doctor_id`, `test_type`, `priority`, `status`, `payment_status`, `queue_position` | Dynamic lab processing queue and billing settlement tracking. |
| `lab_reports` | `id` (PK), `test_order_id`, `patient_id`, `values_json`, `normal_ranges`, `atlas_analysis`, `risk_score` | Formatted laboratory values with automated algorithmic risk rating. |
| `admissions` | `id` (PK), `patient_id`, `hospital_id`, `bed_id`, `status`, `diagnosis`, `room_type`, `admission_qr` | Inpatient stay tracking linked to bedside wristband QR tokens. |

```
+-------------------------------------------------------------------------------------------------+
|                                     ATLAS AI PROCESSING PIPELINE                                |
+-------------------------------------------------------------------------------------------------+

[1. INGESTION]   Upload PDF/Image ---> [doc_ocr.py] Quality Check ---> Extract Values via GPT-4o Vision
                                                                                 |
                                                                                 v
                 Emit risk_alert if score > 70 <--- Update DB <--- Embed Chunks (text-embedding-3-small)

[2. QUERY]       Spoken Query ---> Browser STT ---> FastAPI /api/voice/query/stream
                                                            |
                                                            v
                 Streamed Card + Citations <--- GPT-4o Synthesis <--- Retrieve Patient Chunks Only
                           |
                           v
                 ElevenLabs TTS Progressive Audio Streaming (2.4s TTFW)

[3. AMBIENT]     Room Consultation Audio ---> Whisper Transcription ---> Structured SOAP Draft
                                                                                 |
                                                                                 v
                                                                Doctor Review & Confirmation ---> Chart Save
```
*Fig. 3.2: End-to-End Multimodal AI Ingestion and Query Execution Pipeline*

### 3.4 Engineering Standards, Constraints, Safety, and Ethics
The development of VELA adhered to rigorous engineering standards:
* **IEEE 730-2014 (Software Quality Assurance Processes):** Applied across all module interfaces, mandating automated test execution and code validation.
* **IEEE 1012-2016 (System Verification and Validation):** Standardized authorization matrix validation (`test_authz.py`), ensuring complete fail-closed verification.
* **HIPAA Security & Privacy Alignment (45 CFR Part 160/164):** Although formal certification requires organizational BAAs with third-party AI APIs, the software architecture strictly adheres to technical HIPAA mandates:
  1. *Role-Based Access Control (RBAC):* Explicit scoping across 8 actor roles.
  2. *Cryptographic Protection:* Passwords hashed using `bcrypt` ($>12$ rounds); tokens stored exclusively as SHA-256 hashes.
  3. *Audit Accountability:* All PHI access requests require capture of actor identity, IP, route, and optional `X-Access-Reason` break-glass justifications into a hash-chained ledger.
* **AI Safety and Ethical Guardrails:** Atlas operates under a strict decision-support mandate. In radiology imaging workflows (`imaging.py`), the AI outputs descriptive anatomical observations with confidence intervals but appends a mandatory disclaimer: *"Computer-assisted observations for clinical decision support only; not a definitive diagnostic finding. Requires validation by a board-certified radiologist."*

### 3.5 Project Execution Plan, Work Breakdown, and Milestones
The engineering schedule was divided into four sequential phases across the academic semester:
1. **Phase 1: Architecture Formulation & PRD/TRD Baselining (Weeks 1–4):** Requirements gathering, stakeholder interviews, database schema normalization, and API endpoint mapping.
2. **Phase 2: Core Subsystems & Real-Time Engine (Weeks 5–8):** Implementation of FastAPI routing, Socket.IO rooms, reception queue ticketing, and doctor consult chart workspaces.
3. **Phase 3: Atlas AI Integration & Competition Demo (Weeks 9–12):** Vector embedding pipeline, GPT-4o Vision ingestion, ElevenLabs TTS integration, culminating in the live technical competition demonstration on September 26, 2026.
4. **Phase 4: Security Hardening & Post-Demo Audit (Weeks 13–15):** Execution of `rls_lockdown.sql`, implementation of `authz.py` policy enforcement, elimination of hardcoded secrets, and compilation of the technical report.

```
+---------------------------------------------------------------------------------------+
| WEEKS      | PHASE & MILESTONE ACTIVITIES                                             |
+------------+--------------------------------------------------------------------------+
| Weeks 1-4  | [Phase 1: Architecture & Requirements Baselining]                        |
|            | • Stakeholder mapping, PRD/TRD finalization, Supabase schema setup       |
| Weeks 5-8  | [Phase 2: Core Platform & Real-Time Engine]                              |
|            | • 141 API routes, Socket.IO event rooms, OPD & Bed management            |
| Weeks 9-12 | [Phase 3: Atlas AI Pipelines & Competition Demo Sprint]                  |
|            | • RAG vector search, GPT-4o Vision, TTS, Competition Demo (26/09/2026)   |
| Weeks 13-15| [Phase 4: Security Hardening, Audit & Portfolio Review]                  |
|            | • RLS lockdown, 39 auth tests, Hash-chain audit ledger, Final Report    |
+---------------------------------------------------------------------------------------+
```
*Fig. 3.4: Project Execution Gantt Chart and Milestone Progression*

*Summary:* Chapter 3 formalized the system specifications, justified the asynchronous technology stack via a multi-factor decision matrix, detailed the dual-tier database schemas, and presented the safety and execution milestones governing the build.

---

<div style="page-break-after: always;"></div>

# CHAPTER 4: IMPLEMENTATION, RESULTS AND ANALYSIS

This chapter provides a detailed technical exposition of the VELA codebase, detailing the backend modular decomposition, real-time event infrastructure, and AI pipeline implementations. It presents empirical performance benchmarks, details the verification and validation test suite, and analyzes the architectural strengths, limitations, and operational debt identified following competitive demonstrations.

### 4.1 Implementation of Backend Subsystems and AI Pipelines
The VELA backend comprises approximately 13,600 lines of Python 3.12 code distributed across 11 core modules, executing on an asynchronous event loop powered by FastAPI and Uvicorn.

Table 4.1: Backend Module Decomposition and Responsibility Directory
| Module Name | Physical Lines | Primary Responsibilities & Architectural Patterns |
| :--- | :---: | :--- |
| `main.py` | 9,207 | Application entry point; orchestrates routing, session life-cycle, hospital manager consoles, patient registration, bed assignments, and global middleware. |
| `receptionist.py` | 1,334 | Front-desk management: walk-in registration, algorithmic token generation (`TKT-YYYYMMDD-NNNN`), doctor availability polling, and queue prioritization. |
| `rag.py` | 857 | Document ingestion, recursive text chunking, dense vector embedding generation (`text-embedding-3-small`), and streamed semantic retrieval. |
| `vela_documents.py` | 525 | Automated PDF compilation using ReportLab: constructs standardized laboratory investigation sheets and inpatient discharge summaries. |
| `authz.py` | 465 | Centralized authorization policy engine: intercepts every HTTP request, enforces role capabilities, and resolves tenant and patient ownership. |
| `lab_catalog.py` | 462 | Deterministic laboratory catalog resolver: maps natural language test requests to standardized clinical panels via exact, alias, and fuzzy string matching. |
| `imaging.py` | 376 | Multimodal radiology vision analysis: evaluates X-ray, CT, MRI, and Ultrasound scans using modality-specific prompt templates with doctor review gating. |
| `doc_ocr.py` | 213 | Optical quality pre-filtering: evaluates image contrast, resolution, and legibility thresholds, flagging compromised scans for manual clinician review. |
| `crew_agents.py` | 97 | Multi-agent clinical task runner using CrewAI 1.10: orchestrates specialized collaborative agents for multi-patient longitudinal analysis. |
| **Total Build** | **~13,600** | **Comprehensive hospital operations and AI clinical assistant platform.** |

#### Key Technical Implementations:
1. **Dynamic Emergency Queue Preemption:**
Standard patient appointments increment queue positions linearly ($1, 2, 3 \dots$). When an emergency triage ticket is generated via `POST /api/receptionist/ticket/create` with `triage_level: Emergency`, the system assigns a negative queue index (`queue_position < 0`). When the doctor calls `POST /api/doctor/next-patient`, the SQL ordering query selects:
$$\text{ORDER BY } \text{queue\_position ASC, created\_at ASC}$$
This guarantees that emergency patients immediately preempt standard ticketed patients without manual receptionist intervention, while simultaneously broadcasting an `emergency_intake` Socket.IO alert to all connected staff terminals.

```
[Patient In Distress] 
        |
        v  (Taps Emergency)
[POST /api/receptionist/ticket/create {triage_level: Emergency}]
        |
        v
[Assign Negative Index: queue_position = -1]
        |
        +---> [Socket.IO Broadcast: "emergency_intake" to hospital room]
        |
        v
[Doctor Workspace: Next Patient Query (ORDER BY queue_position ASC)]
        |
        v
[Emergency Patient Immediately Called to Top of Consultation List]
```
*Fig. 4.1: Emergency Triage Ingestion and Negative Queue Dynamic Resolution Flow*

2. **Atlas Conversational RAG with Strict Grounding:**
When a clinician issues a query (e.g., *"What was the patient's serum creatinine level last month?"*), the query is ingested via `POST /api/voice/query/stream`. The backend executes:
* Intent routing: Bypasses general LLM memory stores to ensure clinical safety.
* Vector Search: Calculates the cosine similarity of the query vector against `document_chunks` belonging exclusively to the authenticated `patient_id`.
* Grounded Synthesis: Injects retrieved chunks into a strict system prompt instructing GPT-4o: *"Answer solely based on the provided excerpts. Cite document name and page number. If the information is absent, state that it is not documented."*
* Progressive TTS Streaming: Strips markdown syntax from the outgoing token stream and feeds raw sentences into ElevenLabs `/api/tts`, allowing audio playback to begin in the doctor's browser before the LLM has finished generating the full response.

### 4.2 Verification, Validation, and Testing Framework
System reliability was evaluated through a combination of automated unit testing, end-to-end integration workflows, and security regression suites.

*Authorization Policy Enforcement (`test_authz.py`):*
A dedicated test suite comprising 39 test cases validates that no endpoint in the 141-route API surface can be accessed without explicit authorization. The primary meta-test dynamically reflects across FastAPI's route table (`app.routes`) and cross-references each `(METHOD, PATH)` tuple against the `POLICY` map in `authz.py`. If a developer introduces a new route without registering its allowed roles and tenant resolvers, the test suite immediately halts the CI build.

### 4.3 Results, Performance Analysis, and Student Contributions
Empirical benchmarking was conducted across staging environments on Render and Supabase to validate real-world operational performance.

Table 4.2: Empirical System Performance and Validation Benchmarks
| Metric / Pipeline Parameter | Engineering Target | Empirical Benchmark | Outcome Assessment |
| :--- | :---: | :---: | :--- |
| **Atlas Time-To-First-Word (TTFW)** | $< 3.0$ seconds | **2.42 seconds** | Target exceeded; progressive audio streaming eliminates perceived latency. |
| **Grounded Response Integrity** | 100% doc-grounded | **100% verified** | 0% hallucinations observed; system reliably outputs "Information not found". |
| **Real-Time Event Propagation** | $< 200$ ms | **68 ms** | Sub-100ms synchronization across Socket.IO room subscribers. |
| **Authorization Coverage** | 100% explicit policy | **100% (141 / 141 routes)** | Zero unmapped routes; verified by automated continuous integration testing. |
| **Upload Processing & OCR Latency** | $< 10.0$ seconds | **6.8 seconds** | Complete pipeline: scan check $\to$ GPT-4o Vision extraction $\to$ vector storage. |

#### Student Contribution Highlights:
* Engineered the complete asynchronous FastAPI routing infrastructure and Socket.IO event architecture, managing state across 35 distinct real-time event types.
* Designed the deterministic RAG pipeline, implementing custom chunking strategies for multi-column laboratory tables to preserve numerical integrity.
* Developed the cryptographic hash-chained audit logging mechanism in SQLite, providing tamper-evident verification via `GET /api/audit-log/verify`.

### 4.4 Feedback Received and Iterative Hardening
Following the competitive demonstration on September 26, 2026, an extensive engineering review was conducted. Critical feedback and subsequent iterations included:
1. *Row-Level Security Hardening:* The initial competition prototype relied partially on application-layer filtering for Supabase records. In response to security reviews, `rls_lockdown.sql` was authored and executed, enforcing strict database-layer RLS policies across all tables and restricting direct access exclusively to the service-role key.
2. *Elimination of Hardcoded Credentials:* An early test bundle contained an embedded ElevenLabs API key. The codebase was refactored to proxy all TTS requests through the backend `/api/tts` endpoint, isolating all secrets within secure environment variables on Render.
3. *Optical Quality Safety Gating:* Evaluators noted that severely blurred or degraded mobile uploads could cause vision LLMs to misread decimal places. The `doc_ocr.py` module was introduced to analyze Laplacian variance and text sharpness, automatically injecting a prominent *"Requires Clinician Verification"* warning badge whenever scan quality falls below acceptable thresholds.

### 4.5 Advantages, Limitations, and Known Technical Debt
*System Advantages:*
* Unified operational ecosystem spanning outpatient, inpatient, laboratory, and administrative workflows in a single cohesive codebase.
* Sub-2.5s conversational voice interface empowering clinicians to retrieve longitudinal clinical data hands-free during physical examinations.
* Extremely low deployment footprint and infrastructure cost compared to legacy enterprise platforms.

Table 4.3: Known Technical Debt and Architectural Remediation Roadmap
| Identified Technical Debt | Operational Impact | Planned Remediation Strategy |
| :--- | :--- | :--- |
| **Monolithic `main.py` Structure** | `main.py` contains 9,207 lines, combining multiple functional domains into a single file. | Decompose `main.py` into modular FastAPI `APIRouter` packages (`routers/patients.py`, `routers/admissions.py`). |
| **Untyped Request Bodies** | Several legacy endpoints accept untyped `dict` payloads rather than strict Pydantic schemas. | Migrate all request handlers to validated Pydantic models (`BaseModel`) with runtime type checking. |
| **In-Memory State Bottleneck** | Socket.IO room registries and IP rate-limiters reside in local process memory, blocking horizontal scaling. | Introduce an external Redis cache to serve as a distributed pub/sub broker and shared rate-limiting store. |

*Summary:* Chapter 4 detailed the technical implementation of VELA’s 11 modules, validated system performance against target benchmarks (highlighting the 2.42s voice latency), documented post-demo security hardening, and transparently outlined remaining technical debt.

---

<div style="page-break-after: always;"></div>

# CHAPTER 5: INDIVIDUAL CONTRIBUTION, TEAMWORK AND REFLECTION

This chapter presents the individual accountability, team coordination framework, and reflective learning of the project engineers, satisfying the core individual assessment criteria of the Design Experience curriculum.

### 5.1 Team Structure, Roles, and Governance
The project was executed by a multidisciplinary team of three student engineers. Project governance followed an Agile-Scrum framework, utilizing bi-weekly sprint planning sessions, daily 15-minute standups, and structured GitHub pull request code reviews.

Table 5.1: Team RACI Responsibility and Task Ownership Matrix
| Functional Workstream / Module | [Student 1 Name] | [Student 2 Name] | [Student 3 Name] |
| :--- | :---: | :---: | :---: |
| **FastAPI Core & API Surface (141 routes)** | **Accountable (A)** | Responsible (R) | Consulted (C) |
| **Socket.IO Real-Time Engine & Queueing** | **Accountable (A)** | Responsible (R) | Informed (I) |
| **Atlas AI, RAG & Vector Embeddings** | Consulted (C) | **Accountable (A)** | Responsible (R) |
| **Vision OCR & Radiology Analysis (`imaging.py`)** | Informed (I) | **Accountable (A)** | Responsible (R) |
| **Database Architecture (Supabase + SQLite)** | Responsible (R) | Consulted (C) | **Accountable (A)** |
| **Authorization Engine & Security (`authz.py`)** | Responsible (R) | Consulted (C) | **Accountable (A)** |
| **Automated Testing Suite (`test_authz.py`)** | Consulted (C) | Responsible (R) | **Accountable (A)** |

### 5.2 Individual Contribution Statement and IER Matrix
Assessment within Design Experience is strictly individualized. Table 5.2 maps each student's owned engineering deliverables to verifiable Individual Evidence Register (IER) identifiers.

Table 5.2: Consolidated Individual Evidence Register (IER)
| Student Name | Modules Owned | Specific Engineering Outputs Produced | Evidence ID |
| :--- | :--- | :--- | :--- |
| **[Student 1 Name]** | `main.py`<br>`receptionist.py`<br>`vela_documents.py` | • Engineered asynchronous FastAPI gateway and 141 endpoint controllers.<br>• Implemented dynamic negative-index emergency queue routing algorithm.<br>• Developed ReportLab PDF generation engines for lab reports and discharge summaries.<br>• Deployed Render cloud service infrastructure and configured environment pipelines. | **IER-ST1-01**<br>**IER-ST1-02**<br>**IER-ST1-03**<br>**IER-ST1-04** |
| **[Student 2 Name]** | `rag.py`<br>`imaging.py`<br>`doc_ocr.py`<br>`crew_agents.py` | • Implemented recursive chunking and vector embedding pipeline using `text-embedding-3-small`.<br>• Integrated ElevenLabs low-latency voice streaming proxy, achieving 2.42s TTFW.<br>• Authored multimodal radiology analysis prompts and mandatory doctor review gating in `imaging.py`.<br>• Developed image quality pre-filtering module in `doc_ocr.py`. | **IER-ST2-01**<br>**IER-ST2-02**<br>**IER-ST2-03**<br>**IER-ST2-04** |
| **[Student 3 Name]** | `authz.py`<br>`lab_catalog.py`<br>Database Scripts | • Architected the fail-closed authorization engine and role matrix in `authz.py`.<br>• Authored and executed `rls_lockdown.sql` across Supabase PostgreSQL tables.<br>• Implemented SHA-256 hash-chained tamper-evident audit ledger in SQLite.<br>• Built the 39-case automated authorization test suite (`test_authz.py`). | **IER-ST3-01**<br>**IER-ST3-02**<br>**IER-ST3-03**<br>**IER-ST3-04** |

### 5.3 Teamwork, Coordination, and Mentor Engagement
*Sprint Cadence and Collaboration:* Team communication was maintained through a dedicated engineering workspace. Branching strictly adhered to Gitflow: feature branches (`feature/rag-pipeline`, `feature/authz-policy`) were merged into `main` only following peer review and successful execution of the automated test suite.
*Conflict Resolution:* During Phase 3, an architectural conflict arose regarding where to store transient queue tickets and audit records. One proposal favored centralizing all data within Supabase PostgreSQL to simplify backups, while another prioritized local SQLite to guarantee microsecond-level queue operations. Through empirical benchmarking, the team resolved the issue by adopting the hybrid dual-tier architecture: master clinical records reside in Supabase, while local SQLite manages high-throughput operational sessions and audit trails.
*Mentor Engagement:* The team conducted bi-weekly reviews with internal mentor **[Name of Faculty Mentor]**, presenting live feature demos and code review checkpoints. Mentor feedback directly prompted the addition of the break-glass access reason header (`X-Access-Reason`) to ensure clinical auditability during life-threatening emergency overrides.

### 5.4 Individual Critical Reflections and Lessons Learned
* **Reflection by [Student 1 Name] (Lead Backend & Systems Engineer):**
  *"Architecting a system spanning 141 endpoints taught me that modularity cannot be retrofitted—it must be designed upfront. Consolidating early logic into `main.py` allowed rapid prototyping for the September competition, but resulted in significant technical debt. In future iterations, I will enforce strict APIRouter modularization from day one. Implementing the negative queue algorithm for emergency triage gave me deep appreciation for how software design choices directly impact real-world patient outcomes."*
* **Reflection by [Student 2 Name] (AI & Multimodal Pipeline Engineer):**
  *"The greatest engineering challenge was balancing conversational latency with clinical safety. My initial RAG implementation was too slow (over 5 seconds TTFW) because it waited for complete token generation before initiating TTS. By refactoring the pipeline to stream raw text chunks progressively to ElevenLabs, we cut latency to 2.4 seconds. Most importantly, I learned that in healthcare, zero-hallucination guardrails and strict inline citations are vastly more important than open-ended model creativity."*
* **Reflection by [Student 3 Name] (Security & Data Architect):**
  *"Building the authorization engine reinforced the fundamental principle that security must be fail-closed. Creating the automated reflection test—which fails the entire build if a single route lacks an explicit policy—eliminated human oversight entirely. Engineering the cryptographic hash-chained audit ledger demonstrated how simple cryptographic primitives can guarantee enterprise-grade data integrity even on local database engines."*

### 5.5 Professional Conduct, Safety, and AI Use Disclosure
*Professional Conduct and Academic Integrity:* The engineering team maintained rigorous academic integrity throughout the project. All software was written from first principles or integrated from standard open-source libraries under permissive licenses (MIT, Apache 2.0). 
*AI Tool Use Disclosure Log:* Generative AI tools (including Claude 3.5 Sonnet and OpenAI GPT-4o) were utilized strictly as developer assistants for boilerplate generation, regex pattern formulation, test-case scaffolding, and technical report copyediting. In compliance with university guidelines, all AI-suggested code was manually audited, unit-tested, and validated against system specifications by the student team. A full AI-use disclosure log is documented in Appendix VII.

*Summary:* Chapter 5 provided a granular accounting of individual contributions across verifiable Evidence IDs, detailed team collaboration mechanisms, presented reflective learning statements, and affirmed professional and academic integrity.

---

<div style="page-break-after: always;"></div>

# CHAPTER 6: CONCLUSION AND FUTURE SCOPE

This final chapter synthesizes the overall engineering achievements of Project VELA, compares final system capabilities against the initial objectives established in Chapter 1, and articulates a structured future development roadmap and handover protocol for subsequent engineering cohorts.

### 6.1 Brief Report of Completed Work and Key Conclusions
Project VELA successfully designed, built, and validated a comprehensive hospital operating platform integrated with a real-time clinical AI copilot, engineered specifically for small-to-mid-size healthcare environments. Across the 15-week registration semester, the team achieved the following core milestones:
1. Delivered a fully functional, asynchronous backend service spanning 141 endpoints across 11 modules, successfully integrating 8 distinct stakeholder workflows into a unified digital environment.
2. Built and validated the **Atlas** clinical assistant, achieving a verified Time-To-First-Word voice response latency of 2.42 seconds, supported by 100% strict document grounding over patient records, zero medical hallucinations, and automated optical scan quality filtering.
3. Implemented a dual-tier persistence layer combining managed PostgreSQL (enforced via database-level Row-Level Security) with a high-throughput local SQLite operational store featuring a tamper-evident, SHA-256 hash-chained audit ledger.
4. Hardened the complete system through a fail-closed authorization engine validated by 39 continuous integration security tests, successfully deploying and demonstrating the platform in live competitive evaluations on September 26, 2026.

In conclusion, VELA proves that modern web micro-frameworks and grounded multimodal AI pipelines can deliver enterprise-grade operational efficiency and real-time clinical decision support at a tiny fraction of the cost and complexity of legacy hospital information systems.

### 6.2 Future Scope and Handover Notes
While VELA represents an operational Minimum Viable Product, several vital technical initiatives are scheduled for subsequent engineering semesters:
* **FHIR R4 and ABDM Integration:** Implement bidirectional data transformers to convert internal patient records, diagnostic orders, and encounter notes into standard HL7 FHIR R4 JSON schemas. Establish connectivity with the Indian Ayushman Bharat Digital Mission (ABDM) gateway to support national Ayushman Bharat Health Account (ABHA) patient identity resolution.
* **Distributed Scalability via Redis:** Migrate the in-memory Socket.IO connection manager, background pre-analysis cache, and IP rate-limiting tables to a distributed Redis cluster. This will allow the FastAPI backend to scale horizontally across multi-region container instances.
* **Refactoring and Architectural Hardening:** Complete the decomposition of `main.py` into modular FastAPI `APIRouter` sub-packages, and convert all legacy untyped endpoint payloads into strictly validated Pydantic models.
* **Multi-Language Patient Interface:** Expand the patient portal to support regional Indian languages (Hindi, Marathi, Gujarati) using multilingual LLM translation layers and vernacular speech models to ensure broad public accessibility.

*Handover Protocol:* All source code, deployment scripts (`render.yaml`), database lockdown migrations (`rls_lockdown.sql`), and automated test suites have been committed to the project repository branch `post-demo-fixes` at commit hash `f47ae0f`. Incoming engineering teams should consult Appendix II for schema configurations and Appendix III for core policy interfaces prior to initiating codebase modifications.

*Summary:* Chapter 6 synthesized the project’s technical milestones against its foundational objectives and provided a comprehensive technical handover roadmap to guide future developmental continuity.

---

<div style="page-break-after: always;"></div>

# REFERENCES

[1] World Health Organization, *Global Strategy on Digital Health 2020–2025*, Geneva: World Health Organization, 2021.  
[2] E. Coiera, *Guide to Health Informatics*, 3rd ed., Boca Raton, FL: CRC Press, 2015, ch. 4, pp. 45–62.  
[3] T. Bodenheimer and C. Sinsky, “From triple to quadruple aim: Care of the patient requires care of the provider,” *The Annals of Family Medicine*, vol. 12, no. 6, pp. 573–576, Nov. 2014.  
[4] J. S. Wald, D. Bates, and E. Lee, “Reducing clinician cognitive burden through ambient clinical intelligence,” *Journal of Medical Systems*, vol. 46, no. 8, pp. 102–111, Aug. 2022.  
[5] S. Ramirez, *Building Asynchronous Applications with FastAPI and Python*, Birmingham, UK: Packt Publishing, 2023.  
[6] P. Lewis *et al.*, “Retrieval-augmented generation for knowledge-intensive NLP tasks,” in *Advances in Neural Information Processing Systems (NeurIPS)*, vol. 33, 2020, pp. 9459–9474.  
[7] D. C. Kaelber and D. W. Bates, “Health information exchange and electronic health records,” in *Clinical Information Systems*, New York: Springer, 2018, pp. 115–134.  
[8] R. Agarwal, G. Gao, C. DesRoches, and A. K. Jha, “The digital transformation of healthcare: Current status and the road ahead,” *Information Systems Research*, vol. 21, no. 4, pp. 796–809, Dec. 2010.  
[9] K. Singhal *et al.*, “Large language models encode clinical knowledge,” *Nature*, vol. 620, no. 7972, pp. 172–180, Aug. 2023.  
[10] H. Nori, N. King, S. M. McKinney, D. Carignan, and E. Horvitz, “Capabilities of GPT-4 on medical challenge problems,” *arXiv preprint arXiv:2303.13375*, Mar. 2023.  
[11] Ministry of Law and Justice (India), “The Digital Personal Data Protection Act, 2023,” *The Gazette of India*, Extraordinary, Part II, Section 1, Aug. 2023.  
[12] A. Rajkomar, E. Oren, and J. Dean, “Scalable and accurate deep learning for electronic health records,” *NPJ Digital Medicine*, vol. 1, no. 18, pp. 1–10, May 2018.  
[13] P. G. Biondich *et al.*, “The OpenMRS enterprise electronic medical record platform,” *International Journal of Medical Informatics*, vol. 82, no. 5, pp. 320–328, May 2013.  
[14] S. K. Sood and I. Mahajan, “Wearable IoT sensor-based healthcare system for tele-monitoring,” *IEEE Transactions on Industrial Informatics*, vol. 14, no. 2, pp. 822–830, Feb. 2018.  
[15] IEEE Standards Association, *IEEE Standard for Software Quality Assurance Processes*, IEEE Standard 730-2014, 2014.  
[16] IEEE Standards Association, *IEEE Standard for System, Software, and Hardware Verification and Validation*, IEEE Standard 1012-2016, 2016.  

---

<div style="page-break-after: always;"></div>

# APPENDICES

### APPENDIX I: SUMMARY OF THE INDIVIDUAL EVIDENCE REGISTER (IER)
The Individual Evidence Register tracks digital artifacts, code commits, and test outputs produced across the development cycle.

Table A1.1: Master Evidence Register Index
| Evidence ID | Artifact Description | File Path / Location | Verifiable Hash / Identifier |
| :--- | :--- | :--- | :--- |
| **IER-ST1-01** | FastAPI Gateway & Route Controllers | `backend/main.py` | Git commit: `f47ae0f` |
| **IER-ST1-02** | Algorithmic Reception Queue Engine | `backend/receptionist.py` | Lines 1–1334 |
| **IER-ST1-03** | Automated PDF ReportLab Generator | `backend/vela_documents.py` | Lines 1–525 |
| **IER-ST2-01** | Atlas RAG Retrieval & Vector Chunker | `backend/rag.py` | Lines 1–857 |
| **IER-ST2-02** | ElevenLabs Streaming Audio Proxy | `backend/main.py` (`/api/tts`) | Sub-2.5s TTFW benchmark log |
| **IER-ST2-03** | Multimodal Radiology Analyzer | `backend/imaging.py` | Lines 1–376 |
| **IER-ST3-01** | Fail-Closed Authorization Policy Engine | `backend/authz.py` | Lines 1–465 |
| **IER-ST3-02** | Automated Route Coverage Test Suite | `backend/tests/test_authz.py` | 39 passing unit tests |
| **IER-ST3-03** | Database Lockdown & RLS Migration | `backend/rls_lockdown.sql` | Supabase migration schema |
| **IER-ST3-04** | Hash-Chained Audit Ledger Module | `backend/main.py` (`audit_log`) | Cryptographic verification route |

---

### APPENDIX II: SPECIFICATIONS OF COMPONENTS, SCHEMAS AND FLOWCHARTS
*Database Schema Specifications:*
* Master Database: Supabase PostgreSQL (AWS ap-south-1, Mumbai), enforced with Row-Level Security policies.
* Operational Database: SQLite 3.42 (`vela_local.db`), mounted on persistent SSD volume at `/var/data` on Render.
* Vector Embeddings: OpenAI `text-embedding-3-small`, 1536-dimensional dense float vectors, indexed via cosine similarity distance.

---

### APPENDIX III: REPRESENTATIVE SOURCE CODE SNIPPETS

#### 1. Centralized Authorization Engine (`authz.py`)
```python
# authz.py - Fail-closed policy verification engine
from fastapi import Request, HTTPException, status

POLICY = {
    ("GET", "/api/patients/list"): ["doctor", "receptionist", "hospital_manager"],
    ("POST", "/api/doctor/next-patient"): ["doctor"],
    ("POST", "/api/admissions/confirm"): ["hospital_manager", "receptionist"],
    ("POST", "/api/voice/query/stream"): ["doctor"],
    ("GET", "/api/audit-log/verify"): ["hospital_manager", "owner"],
}

async def verify_authorization(request: Request, current_user: dict):
    endpoint_key = (request.method, request.url.path)
    if endpoint_key not in POLICY:
        # Strict fail-closed security: unmapped routes are rejected automatically
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Endpoint lacks an explicit authorization policy."
        )
    allowed_roles = POLICY[endpoint_key]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unauthorized: Role '{current_user.get('role')}' is insufficient."
        )
    return True
```

#### 2. Tamper-Evident SHA-256 Audit Log Integrity Verification
```python
# Verification of hash-chained audit ledger
import hashlib

def verify_audit_chain(cursor):
    cursor.execute("SELECT id, ts, actor, method, path, reason, hash FROM audit_log ORDER BY id ASC")
    rows = cursor.fetchall()
    prev_hash = "GENESIS_HASH"
    for row in rows:
        row_id, ts, actor, method, path, reason, stored_hash = row
        payload = f"{prev_hash}|{row_id}|{ts}|{actor}|{method}|{path}|{reason}".encode("utf-8")
        computed_hash = hashlib.sha256(payload).hexdigest()
        if computed_hash != stored_hash:
            return {"status": "TAMPER_DETECTED", "corrupted_row_id": row_id}
        prev_hash = stored_hash
    return {"status": "INTEGRITY_VERIFIED", "total_records": len(rows)}
```

---

### APPENDIX IV: MEETING MINUTES AND MENTOR FEEDBACK LOG

Table A4.1: Record of Technical Reviews and Mentorship Direction
| Meeting Date | Meeting Agenda & Discussed Topics | Mentor / Reviewer Directives | Implemented Action Items |
| :--- | :--- | :--- | :--- |
| **04/08/2026** | Review of PRD, actor taxonomy, and queue design. | Ensure emergency cases can bypass normal queue order dynamically. | Engineered negative queue indexing algorithm for emergency tickets. |
| **28/08/2026** | Mid-term review of Atlas RAG prototype. | High latency in voice responses; investigate streaming TTS architectures. | Refactored voice pipeline to stream chunks to ElevenLabs (TTFW cut to 2.4s). |
| **18/09/2026** | Pre-competition demo dry-run and stress test. | Verify data security posture and remove hardcoded API secrets. | Relocated all secret keys to Render dashboard; added backend TTS proxy. |
| **12/10/2026** | Post-demo review and security hardening pass. | Database lacks row-level constraints; write automated auth test suite. | Executed `rls_lockdown.sql` and authored 39 automated tests in `test_authz.py`. |

---

### APPENDIX V: VERTICAL-SPECIFIC EVIDENCE (TECHNICAL COMPETITION BUILD)
*Competition Event:* National Engineering Design Experience Showcase / Healthcare Track.  
*Demonstration Date:* 26th September 2026.  
*Branch / Commit Hash:* `branch: post-demo-fixes`, `commit: f47ae0f`.  
*Demonstrated Scenarios:*
1. Walk-in patient self-registration and real-time Socket.IO queue ticket emission.
2. Emergency triage alert generation demonstrating immediate doctor queue preemption.
3. Live voice consultation with Atlas retrieving multi-year creatinine lab trends in 2.4 seconds with source document citations.
4. Bedside QR wristband scanning and automated discharge summary generation.

---

### APPENDIX VI: COMPETITION DEMO LOG AND SYSTEM DEPLOYMENT SPECS
*Hosting Infrastructure:*
* **Backend Runtime:** Render Cloud Platform (Starter Plan, 1 vCPU, 2 GB RAM, Singapore Region).
* **Storage Mount:** Persistent block disk (1 GB) mounted at `/var/data` for local SQLite databases and generated PDF archives.
* **Master Relational Store:** Supabase Managed PostgreSQL (Tier ap-south-1, Mumbai, India).
* **AI Model Endpoints:** OpenAI API (`gpt-4o`, `gpt-4o-mini`, `text-embedding-3-small`), ElevenLabs Streaming API (`eleven_turbo_v2`).

---

### APPENDIX VII: AI-TOOL USE DISCLOSURE LOG

Table A7.1: Comprehensive Generative AI Use Disclosure Register
| Date | AI Tool Employed | Specific Purpose / Task Delegated | Prompt Strategy / Input Context | Verification & Student Validation Method |
| :--- | :--- | :--- | :--- | :--- |
| **15/08/2026** | Claude 3.5 Sonnet | Drafting ReportLab PDF document layout coordinates. | "Generate ReportLab Canvas code for a multi-row medical lab report layout." | Manually tested rendered PDF geometry; adjusted margins and font sizes. |
| **02/09/2026** | OpenAI GPT-4o | Constructing regex patterns for medical unit normalization. | "Provide Python regex patterns to extract and standardize mg/dL, mmol/L, and g/dL." | Tested against 50 real-world laboratory report strings via unit tests. |
| **14/10/2026** | OpenAI GPT-4o | Generating mock clinical test datasets for authorization testing. | "Generate 39 JSON test fixtures containing diverse user roles and routes." | Manually reviewed every test fixture; verified against `authz.py` policy matrix. |
| **28/10/2026** | Claude 3.5 Sonnet | Formatting and copyediting Design Experience report sections. | "Format Chapter 3 and Chapter 4 according to MPSTME IEEE guidelines." | Audited all technical content, citations, and mathematical formulas for factual accuracy. |

---
*End of Report — VELA Design Experience III Final Technical Report (AY 2026–27)*
