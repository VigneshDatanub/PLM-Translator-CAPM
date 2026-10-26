using { TranslatorService as service } from './translator-service';

// Annotate TestResults for Fiori Elements
annotate service.TestResults with @(
    // 1. Header Information for the Entity
    UI.HeaderInfo : {
        TypeName       : 'Translation Record',
        TypeNamePlural : 'Translation Records',
        Title          : {
            $Type : 'UI.DataField',
            Value : textToTranslate
        },
        Description    : {
            $Type : 'UI.DataField',
            Value : targetLanguage
        }
    },

    // 2. Filter Bar (Selection Fields at the top of the page)
    UI.SelectionFields : [
        outcome,
        targetLanguage,
        testedBy,
        createdAt
    ],

    // 3. Main Fiori Smart Table Columns
    UI.LineItem : [
        {
            $Type       : 'UI.DataField',
            Value       : outcome,
            Label       : 'Status',
            Criticality : (outcome = 'Success' ? 3 : outcome = 'Failure' ? 1 : 2) // 3=Green, 1=Red, 2=Yellow
        },
        {
            $Type : 'UI.DataField',
            Value : accuracy,
            Label : 'Accuracy (%)'
        },
        {
            $Type : 'UI.DataField',
            Value : targetLanguage,
            Label : 'Target Lang'
        },
        {
            $Type : 'UI.DataField',
            Value : textToTranslate,
            Label : 'Original Text'
        },
        {
            $Type : 'UI.DataField',
            Value : translatedText,
            Label : 'Translated Text'
        },
        {
            $Type : 'UI.DataField',
            Value : testedBy,
            Label : 'Tested By'
        },
        {
            $Type : 'UI.DataField',
            Value : createdAt,
            Label : 'Date Created'
        }
    ],

    // 4. Object Page (Detail View when a row is clicked)
    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'TranslationDetailsFacet',
            Label  : 'Translation Details',
            Target : '@UI.FieldGroup#TranslationDetails'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'QAReviewFacet',
            Label  : 'QA & Review Notes',
            Target : '@UI.FieldGroup#QAReview'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'AdminFacet',
            Label  : 'System Info',
            Target : '@UI.FieldGroup#Admin'
        }
    ],

    // Detail Field Groups for the Object Page
    UI.FieldGroup #TranslationDetails : {
        Data : [
            { $Type : 'UI.DataField', Value : sourceLanguage,  Label : 'Source Language' },
            { $Type : 'UI.DataField', Value : targetLanguage,  Label : 'Target Language' },
            { $Type : 'UI.DataField', Value : textToTranslate, Label : 'Source Text' },
            { $Type : 'UI.DataField', Value : translatedText,  Label : 'Google Translated Output' }
        ]
    },
    UI.FieldGroup #QAReview : {
        Data : [
            {
                $Type       : 'UI.DataField',
                Value       : outcome,
                Label       : 'Outcome',
                Criticality : (outcome = 'Success' ? 3 : outcome = 'Failure' ? 1 : 2)
            },
            { $Type : 'UI.DataField', Value : accuracy,    Label : 'Accuracy (%)' },
            { $Type : 'UI.DataField', Value : testedBy,    Label : 'Tested By' },
            { $Type : 'UI.DataField', Value : observation, Label : 'Observations / Feedback' }
        ]
    },
    UI.FieldGroup #Admin : {
        Data : [
            { $Type : 'UI.DataField', Value : sessionId, Label : 'Session ID' },
            { $Type : 'UI.DataField', Value : createdAt, Label : 'Created At' },
            { $Type : 'UI.DataField', Value : createdBy, Label : 'Created By' }
        ]
    }
);

// Annotations for Language Dropdown Value Help
annotate service.Languages with {
    code @(
        Common.Text            : text,
        Common.TextArrangement : #TextLast
    );
};

annotate service.TestResults {
    targetLanguage @(
        Common.Label                   : 'Target Language',
        Common.ValueListWithFixedValues : true,
        Common.ValueList               : {
            CollectionPath : 'Languages',
            Label          : 'Supported Languages',
            Parameters     : [
                {
                    $Type             : 'Common.ValueListParameterInOut',
                    LocalDataProperty : targetLanguage,
                    ValueListProperty : 'code'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'text'
                }
            ]
        }
    );
};
