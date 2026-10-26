using from './annotations';

using {sap.plm.translator as my} from '../db/schema';

service TranslatorService @(path: '/api/translator') {

    // Read and query test results with OData filtering, sorting & pagination
    @readonly
    entity TestResults     as projection on my.TestResults;

    @readonly
    entity TranslationJobs as projection on my.TranslationJobs;

    @readonly
    entity Languages       as projection on my.Languages;

    // Type definition for language items
    type LanguageItem {
        code : String;
        text : String;
    };

    // Single text translation via Google Cloud Translation API
    action   translateText(text: LargeString,
                           targetLanguage: String) returns {
        success                  : Boolean;
        source_text              : LargeString;
        translated_text          : LargeString;
        detected_source_language : String;
        target_language          : String;
        error                    : String;
    };

    // Save test verification / accuracy feedback
    action   saveTestResult(outcome: String,
                            accuracy: Decimal(5, 2),
                            observation: LargeString,
                            testedBy: String,
                            sourceText: LargeString,
                            translatedText: LargeString,
                            sourceLanguage: String,
                            targetLanguage: String,
                            sessionId: String)     returns TestResults;

    // Mass translation from uploaded Excel (base64)
    action   massTranslate(fileContentBase64: LargeString,
                           targetLanguages: array of String,
                           testedBy: String)       returns {
        jobId     : UUID;
        message   : String;
        totalRows : Integer;
    };

    // List supported languages from Google Translate
    function getSupportedLanguages()               returns array of LanguageItem;

    // Analytics summary
    function getStatistics()                       returns {
        total       : Integer;
        success     : Integer;
        failed      : Integer;
        partial     : Integer;
        successRate : Decimal(5, 2);
    };
}
