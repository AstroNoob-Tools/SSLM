# Product Requirements Document (PRD)
## FITS Image Quality Analyzer

### 1. Introduction
#### 1.1 Purpose
The FITS Image Quality Analyzer is a specialized software tool designed to automate the quality assessment and selection of astronomical sub-frames (FITS files). It aims to replace manual, subjective grading with objective, multi-metric scientific analysis to improve the quality of final stacked images.

#### 1.2 Scope
The system will analyze images from ground-based telescopes (specifically Seestar S50), calculate key quality metrics (FWHM, Eccentricity, SNR), and automatically grade and organize files based on user-configurable strategies. It is designed to integrate into an existing Node.js-based workflow.

### 2. User Stories
-   **US-1**: As an astrophotographer, I want to automatically discard frames with trailed stars (tracking errors) so they don't ruin my stack.
-   **US-2**: As an astrophotographer, I want to filter frames based on sharpness (FWHM) to maximize the resolution of my final image.
-   **US-3**: As a user, I want to select different PSF models (e.g., Moffat vs. Gaussian) to best match the atmospheric conditions of my observing site.
-   **US-4**: As a user, I want the system to automatically determine the "best" frames relative to the best single frame of the night, rather than guessing absolute numbers.
-   **US-5**: As a developer, I want to integrate this analysis into my existing application via a simple API.

### 3. Functional Requirements

#### 3.1 Core Analysis
-   **FR-1**: The system MUST accept standard FITS files as input.
-   **FR-2**: The system MUST calculate the following metrics:
    -   **FWHM** (Full Width at Half Maximum) in pixels and arcseconds.
    -   **Eccentricity** (Roundness).
    -   **SNR** (Signal-to-Noise Ratio).
    -   **Star Count**.
    -   **Background Median** (Sky brightness).
-   **FR-3**: The system MUST support the following Point Spread Function (PSF) models:
    -   Moffat2D (Default)
    -   Gaussian2D
    -   Lorentzian2D
    -   Voigt2D (Experimental)

#### 3.2 Batch Processing & Selection
-   **FR-4**: The system MUST be able to process an entire directory of files in a single batch operation.
-   **FR-5**: The system MUST implement an **"Evolutive Selection"** engine that grades frames based on a configurable weighted formula of all metrics.
-   **FR-6**: The system MUST implement a **"Reference Frame"** strategy, where all frames are scored as a percentage relative to the session's best frame.
-   **FR-7**: The system MUST allow file organization (e.g., moving accepted frames to a `BestFrames` folder).

#### 3.3 Integration & Output
-   **FR-8**: The system MUST output analysis results in structured JSON format.
-   **FR-9**: The system MUST provide a CLI argument interface for configuration (Model selection, thresholds, input paths).

### 4. Non-Functional Requirements
-   **NFR-1 Performance**: The batch processing engine should optimize startup time (e.g., by loading the runtime once for N files).
-   **NFR-2 Accuracy**: FWHM calculations should generally align with standard astronomical software (e.g., PixInsight, ASTAP) within reasonable margins for the chosen model.
-   **NFR-3 Compatibility**: The Core Module must run on Python 3.8+; the Orchestrator must run on Node.js 14+.

### 5. Constraints
-   Memory usage should be managed to allow processing of large format FITS files on standard consumer hardware.
