import cds from '@sap/cds';
import axios from 'axios';
import xlsx from 'xlsx';

export default cds.service.impl(async function () {
    const { TestResults, TranslationJobs, Languages } = this.entities;
    const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;

    const GCP_API_KEY = process.env.GCP_TRANSLATE_API_KEY || '';
    const GCP_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

    // 1. Single Text Translation Handler
    this.on('translateText', async (req) => {
        const { text, targetLanguage } = req.data;

        if (!text || !targetLanguage) {
            return req.error(400, 'Both "text" and "targetLanguage" are required.');
        }

        if (!GCP_API_KEY) {
            return req.error(500, 'Google Cloud Translation API Key is missing. Check your .env file.');
        }

        try {
            const response = await axios.post(
                GCP_TRANSLATE_URL,
                { q: text, target: targetLanguage, format: 'text' },
                { params: { key: GCP_API_KEY }, headers: { 'Content-Type': 'application/json' } }
            );

            const result = response.data.data.translations[0];
            return {
                success: true,
                source_text: text,
                translated_text: result.translatedText,
                detected_source_language: result.detectedSourceLanguage || 'auto',
                target_language: targetLanguage
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error?.message || err.message;
            return req.error(500, `Google Translation failed: ${errorMsg}`);
        }
    });

    // 2. Language Synchronization & Retrieval from Google Cloud Translation API
    let syncPromise = null;
    let lastSyncTime = 0;
    const SYNC_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours cache

    async function syncSupportedLanguages(force = false) {
        const now = Date.now();
        if (!force && lastSyncTime > 0 && now - lastSyncTime < SYNC_CACHE_TTL) {
            return;
        }

        if (syncPromise) {
            return syncPromise;
        }

        syncPromise = (async () => {
            try {
                if (!GCP_API_KEY) {
                    console.warn('[TranslatorService] GCP_TRANSLATE_API_KEY is not configured; skipping language sync.');
                    return 0;
                }

                // Check if languages already exist in DB and we are not forcing refresh
                const existing = await SELECT.from(Languages).columns('count(*) as count');
                const count = existing[0]?.count || 0;
                if (!force && count > 0 && lastSyncTime > 0) {
                    return count;
                }

                console.log('[TranslatorService] Fetching supported languages from Google Cloud Translation API...');
                const response = await axios.get(`${GCP_TRANSLATE_URL}/languages`, {
                    params: { key: GCP_API_KEY, target: 'en' }
                });

                const rawLanguages = response.data?.data?.languages || [];
                if (rawLanguages.length > 0) {
                    const entries = rawLanguages.map((l) => ({
                        code: l.language,
                        text: l.name || l.language
                    }));

                    await DELETE.from(Languages);
                    await INSERT.into(Languages).entries(entries);

                    lastSyncTime = Date.now();
                    console.log(`[TranslatorService] Successfully synchronized ${entries.length} languages from Google Cloud Translation API.`);
                    return entries.length;
                }
                return 0;
            } catch (err) {
                const errorMsg = err.response?.data?.error?.message || err.message;
                console.error(`[TranslatorService] Failed to synchronize languages from Google Translation API: ${errorMsg}`);
                return 0;
            } finally {
                syncPromise = null;
            }
        })();

        return syncPromise;
    }

    // Auto-sync languages on service startup
    setImmediate(() => {
        syncSupportedLanguages().catch((err) => {
            console.error('[TranslatorService] Startup language sync error:', err.message);
        });
    });

    // Ensure languages are populated before any READ on Languages entity
    this.before('READ', Languages, async () => {
        await syncSupportedLanguages();
    });

    // Action to manually force refresh supported languages
    this.on('syncSupportedLanguages', async () => {
        const count = await syncSupportedLanguages(true);
        return count;
    });

    // Dynamic Supported Languages List function
    this.on('getSupportedLanguages', async (req) => {
        await syncSupportedLanguages();

        const dbLangs = await SELECT.from(Languages);
        if (dbLangs && dbLangs.length > 0) {
            return dbLangs.map((l) => ({ code: l.code, text: l.text }));
        }

        if (!GCP_API_KEY) {
            return req.error(500, 'Google Cloud Translation API Key is missing. Check your .env file.');
        }

        // Fallback: direct fetch from Google
        try {
            const response = await axios.get(`${GCP_TRANSLATE_URL}/languages`, {
                params: { key: GCP_API_KEY, target: 'en' }
            });

            return (response.data?.data?.languages || []).map((l) => ({
                code: l.language,
                text: l.name || l.language
            }));
        } catch (err) {
            const errorMsg = err.response?.data?.error?.message || err.message;
            return req.error(500, `Could not fetch Google languages: ${errorMsg}`);
        }
    });

    // 3. Save Test Verification Results
    this.on('saveTestResult', async (req) => {
        const data = req.data;
        const normalizedOutcome = data.outcome === 'Failed' ? 'Failure' : data.outcome;

        const entry = {
            ID: cds.utils.uuid(),
            outcome: normalizedOutcome,
            accuracy: data.accuracy || 0,
            observation: data.observation || '',
            testedBy: data.testedBy || req.user?.id || 'Anonymous',
            textToTranslate: data.sourceText,
            translatedText: data.translatedText,
            sourceLanguage: data.sourceLanguage || 'auto',
            targetLanguage: data.targetLanguage,
            sessionId: data.sessionId || cds.utils.uuid()
        };

        await INSERT.into(TestResults).entries(entry);
        return entry;
    });

    // 4. Mass Translation (Excel batching)
    this.on('massTranslate', async (req) => {
        const { fileContentBase64, targetLanguages, testedBy } = req.data;

        const buffer = Buffer.from(fileContentBase64, 'base64');
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!rows || rows.length === 0) {
            return req.error(400, 'Uploaded Excel file is empty.');
        }

        const jobId = cds.utils.uuid();
        const totalItems = rows.length * targetLanguages.length;

        await INSERT.into(TranslationJobs).entries({
            ID: jobId,
            totalRows: totalItems,
            status: 'IN_PROGRESS'
        });

        // Run batch translation asynchronously in background
        setImmediate(async () => {
            let processed = 0;
            let successCount = 0;
            let failureCount = 0;
            const sessionId = `gcp_mass_${Date.now()}`;
            const BATCH_SIZE = 50;

            for (const lang of targetLanguages) {
                const validRows = rows.filter((r) => {
                    const text = r['Phrase Text'] || r['Text'] || r['text'] || Object.values(r)[0];
                    return text && String(text).trim() !== '';
                });

                for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
                    const chunk = validRows.slice(i, i + BATCH_SIZE);
                    const textsToTranslate = chunk.map((r) =>
                        String(r['Phrase Text'] || r['Text'] || r['text'] || Object.values(r)[0])
                    );

                    try {
                        const response = await axios.post(
                            GCP_TRANSLATE_URL,
                            { q: textsToTranslate, target: lang, format: 'text' },
                            { params: { key: GCP_API_KEY }, headers: { 'Content-Type': 'application/json' } }
                        );

                        const translations = response.data.data.translations;
                        const dbBatch = chunk.map((r, idx) => ({
                            ID: cds.utils.uuid(),
                            outcome: 'Success',
                            accuracy: 100.0,
                            observation: 'Mass translation',
                            testedBy: testedBy || 'Batch',
                            textToTranslate: textsToTranslate[idx],
                            translatedText: translations[idx]?.translatedText || '',
                            sourceLanguage: translations[idx]?.detectedSourceLanguage || 'auto',
                            targetLanguage: lang,
                            sessionId: sessionId
                        }));

                        await INSERT.into(TestResults).entries(dbBatch);
                        successCount += chunk.length;
                    } catch (e) {
                        const failedBatch = chunk.map((r, idx) => ({
                            ID: cds.utils.uuid(),
                            outcome: 'Failure',
                            accuracy: 0.0,
                            observation: `GCP Error: ${e.response?.data?.error?.message || e.message}`,
                            testedBy: testedBy || 'Batch',
                            textToTranslate: textsToTranslate[idx],
                            translatedText: 'ERROR',
                            sourceLanguage: 'auto',
                            targetLanguage: lang,
                            sessionId: sessionId
                        }));

                        await INSERT.into(TestResults).entries(failedBatch);
                        failureCount += chunk.length;
                    }

                    processed += chunk.length;
                    await UPDATE(TranslationJobs, jobId).with({
                        processedRows: processed,
                        successfulRows: successCount,
                        failedRows: failureCount
                    });
                }
            }

            await UPDATE(TranslationJobs, jobId).with({ status: 'COMPLETED' });
        });

        return { jobId, message: 'Mass translation started', totalRows: rows.length };
    });

    // 5. Statistics
    this.on('getStatistics', async () => {
        const allResults = await SELECT.from(TestResults);
        const total = allResults.length;
        const success = allResults.filter((r) => r.outcome === 'Success').length;
        const failed = allResults.filter((r) => r.outcome === 'Failure').length;
        const partial = allResults.filter((r) => r.outcome === 'Partial').length;
        const successRate = total > 0 ? Number(((success / total) * 100).toFixed(2)) : 0;

        return { total, success, failed, partial, successRate };
    });
});
