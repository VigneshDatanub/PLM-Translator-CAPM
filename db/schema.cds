namespace sap.plm.translator;

using {
    cuid,
    managed
} from '@sap/cds/common';

/**
 * Stores single and batch translation test/validation results
 */
entity TestResults : cuid, managed {
    outcome         : String(50); // 'Success', 'Failure', 'Partial'
    accuracy        : Decimal(5, 2); // e.g., 100.00%
    observation     : LargeString; // Reviewer notes or error messages
    testedBy        : String(100); // Reviewer/user ID
    textToTranslate : LargeString; // Original text
    translatedText  : LargeString; // Translated output
    sourceLanguage  : String(50) default 'auto';
    targetLanguage  : String(50); // e.g., 'es', 'de'
    sessionId       : String(100); // Session UUID
}

/**
 * Tracks batch / mass Excel translation jobs
 */
entity TranslationJobs : cuid, managed {
    totalRows      : Integer;
    processedRows  : Integer default 0;
    successfulRows : Integer default 0;
    failedRows     : Integer default 0;
    status         : String(20) default 'PENDING'; // 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    errorMessage   : LargeString;
}

/**
 * Supported Languages for Value Help
 */
entity Languages {
    key code : String(50);
        text : String(100);
}
