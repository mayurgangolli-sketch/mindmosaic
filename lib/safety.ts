/**
 * Safety pattern detection for mental health crisis and acute medical emergencies.
 * 
 * IMPORTANT: Automated keyword/pattern detection cannot guarantee 100% comprehensive
 * detection of emergencies, and does NOT replace professional psychiatric or medical care.
 */

export interface SafetyCheckResult {
  isCrisis: boolean;
  isMedicalEmergency: boolean;
  emergencyType?: 'crisis' | 'medical';
  reason?: string;
}

// Red-flag acute medical symptoms requiring immediate emergency care
const ACUTE_MEDICAL_PATTERNS = [
  /worst headache of (?:my )?life/i,
  /thunderclap headache/i,
  /sudden severe headache/i,
  /sudden (?:numbness|paralysis|weakness)\b/i,
  /cannot speak|slurred speech/i,
  /sudden (?:loss of vision|blindness)/i,
  /severe chest (?:pain|pressure|tightness)/i,
  /coughing up blood/i,
];

// Crisis and self-harm keywords designed to minimize false positives
const CRISIS_PATTERNS = [
  /\b(?:want to|going to|thinking of|plan to)\s+die(?!\s+(?:of\s+(?:laughter|embarrassment|curiosity)|laughing))\b/i,
  /\b(?:want to|going to|thinking of|plan to)\s+kill myself\b/i,
  /\bend (?:my|it all)\s+life\b/i,
  /\bend it all\b/i,
  /\bcommit suicide\b/i,
  /\bthoughts of suicide\b/i,
  /\bfeel suicidal\b/i,
  /\bsuicide\b/i,
  /\bsuicidal\b/i,
  /\bself[- ]harm\b/i,
  /\b(?:want to|going to|thinking of|plan to|trying to)\s+hurt myself\b/i,
  /\bintentionally hurt myself\b/i,
  /\b(?:don'?t|do not)\s+want to\s+(?:wake up|live|exist|be here anymore)\b/i,
  /\bbetter off (?:dead|without me)\b/i,
  /\bno reason to (?:live|go on)\b/i,
  /\bcan'?t go on (?:living|anymore)\b/i,
];

// False positive exceptions (everyday expressions)
const FALSE_POSITIVE_EXCEPTIONS = [
  /\bdead tired\b/i,
  /\bkilling it\b/i,
  /\bdying of (?:laughter|laughing|embarrassment|curiosity)\b/i,
  /\baccidentally hurt myself\b/i,
  /\bhurt myself (?:playing|working|exercising|cooking|while)\b/i,
];

export function checkSafetyPatterns(text: string): SafetyCheckResult {
  if (!text || typeof text !== 'string') {
    return { isCrisis: false, isMedicalEmergency: false };
  }

  const trimmed = text.trim();

  // Check acute medical emergencies first
  for (const pattern of ACUTE_MEDICAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isCrisis: false,
        isMedicalEmergency: true,
        emergencyType: 'medical',
        reason: 'Acute severe medical warning sign detected.',
      };
    }
  }

  // Check if text matches harmless common idioms first
  const isHarmlessIdiom = FALSE_POSITIVE_EXCEPTIONS.some((pat) => pat.test(trimmed));

  // Check crisis and self-harm expressions
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(trimmed)) {
      // If it matched an explicit exception and didn't contain explicit suicide/self-harm
      if (isHarmlessIdiom && !/\b(?:suicide|suicidal|kill myself|end my life|self[- ]harm)\b/i.test(trimmed)) {
        continue;
      }
      return {
        isCrisis: true,
        isMedicalEmergency: false,
        emergencyType: 'crisis',
        reason: 'Crisis or self-harm expression detected.',
      };
    }
  }

  return { isCrisis: false, isMedicalEmergency: false };
}
