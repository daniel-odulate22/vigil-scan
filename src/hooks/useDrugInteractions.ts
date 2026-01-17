import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DrugInteraction {
  severity: 'high' | 'moderate' | 'low';
  description: string;
  drug1: string;
  drug2: string;
}

interface InteractionResult {
  hasInteractions: boolean;
  interactions: DrugInteraction[];
  checkedDrug: string;
  conflictingDrugs: string[];
}

interface RxCUIResponse {
  idGroup?: {
    rxnormId?: string[];
  };
}

interface InteractionAPIResponse {
  fullInteractionTypeGroup?: Array<{
    fullInteractionType?: Array<{
      interactionPair?: Array<{
        description?: string;
        severity?: string;
        interactionConcept?: Array<{
          minConceptItem?: {
            name?: string;
          };
        }>;
      }>;
    }>;
  }>;
}

// Get RxCUI from drug name using NIH RxNorm API
const getRxCUI = async (drugName: string): Promise<string | null> => {
  try {
    // Clean the drug name - remove dosage info, keep just the drug name
    const cleanName = drugName.split(' ')[0].toLowerCase();
    
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(cleanName)}&search=1`
    );
    
    if (!response.ok) return null;
    
    const data: RxCUIResponse = await response.json();
    return data.idGroup?.rxnormId?.[0] || null;
  } catch (error) {
    console.error('Error fetching RxCUI:', error);
    return null;
  }
};

// Check interactions between multiple RxCUIs
const checkInteractionsBetweenDrugs = async (
  rxcuis: string[]
): Promise<InteractionAPIResponse | null> => {
  if (rxcuis.length < 2) return null;
  
  try {
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuis.join('+')}`
    );
    
    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error('Error checking interactions:', error);
    return null;
  }
};

// Parse severity from API response
const parseSeverity = (severityStr?: string): 'high' | 'moderate' | 'low' => {
  if (!severityStr) return 'moderate';
  const lower = severityStr.toLowerCase();
  if (lower.includes('high') || lower.includes('severe') || lower.includes('serious')) {
    return 'high';
  }
  if (lower.includes('low') || lower.includes('minor') || lower.includes('mild')) {
    return 'low';
  }
  return 'moderate';
};

export const useDrugInteractions = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkInteractionsWithPrescriptions = useCallback(
    async (newDrugName: string): Promise<InteractionResult> => {
      setIsChecking(true);
      setError(null);

      const result: InteractionResult = {
        hasInteractions: false,
        interactions: [],
        checkedDrug: newDrugName,
        conflictingDrugs: [],
      };

      try {
        // Get user's active prescriptions
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('User not authenticated');
          return result;
        }

        const { data: prescriptions, error: prescriptionError } = await supabase
          .from('prescriptions')
          .select('medication_name')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (prescriptionError) {
          console.error('Error fetching prescriptions:', prescriptionError);
          setError('Failed to fetch prescriptions');
          return result;
        }

        if (!prescriptions || prescriptions.length === 0) {
          return result; // No existing prescriptions to check against
        }

        // Get RxCUI for the new drug
        const newDrugRxCUI = await getRxCUI(newDrugName);
        if (!newDrugRxCUI) {
          // Can't find RxCUI, but don't block the user
          console.log('Could not find RxCUI for:', newDrugName);
          return result;
        }

        // Get RxCUIs for existing prescriptions
        const existingDrugsWithRxCUI: Array<{ name: string; rxcui: string }> = [];
        
        for (const prescription of prescriptions) {
          const rxcui = await getRxCUI(prescription.medication_name);
          if (rxcui) {
            existingDrugsWithRxCUI.push({
              name: prescription.medication_name,
              rxcui,
            });
          }
        }

        if (existingDrugsWithRxCUI.length === 0) {
          return result; // No existing drugs with valid RxCUIs
        }

        // Check interactions between new drug and all existing drugs
        const allRxCUIs = [newDrugRxCUI, ...existingDrugsWithRxCUI.map(d => d.rxcui)];
        const interactionData = await checkInteractionsBetweenDrugs(allRxCUIs);

        if (!interactionData?.fullInteractionTypeGroup) {
          return result;
        }

        // Parse interactions
        for (const group of interactionData.fullInteractionTypeGroup) {
          for (const interactionType of group.fullInteractionType || []) {
            for (const pair of interactionType.interactionPair || []) {
              const description = pair.description || 'Potential interaction detected';
              const severity = parseSeverity(pair.severity);
              
              // Get drug names from the interaction
              const drugs = pair.interactionConcept?.map(
                c => c.minConceptItem?.name || 'Unknown'
              ) || [];

              // Find which of our drugs are involved
              const drug1 = drugs[0] || newDrugName;
              const drug2 = drugs[1] || 'existing medication';

              result.interactions.push({
                severity,
                description,
                drug1,
                drug2,
              });

              if (!result.conflictingDrugs.includes(drug2)) {
                result.conflictingDrugs.push(drug2);
              }
            }
          }
        }

        result.hasInteractions = result.interactions.length > 0;
      } catch (err) {
        console.error('Error checking drug interactions:', err);
        setError('Failed to check drug interactions');
      } finally {
        setIsChecking(false);
      }

      return result;
    },
    []
  );

  const checkAllPrescriptionInteractions = useCallback(async (): Promise<InteractionResult> => {
    setIsChecking(true);
    setError(null);

    const result: InteractionResult = {
      hasInteractions: false,
      interactions: [],
      checkedDrug: 'all prescriptions',
      conflictingDrugs: [],
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return result;
      }

      const { data: prescriptions, error: prescriptionError } = await supabase
        .from('prescriptions')
        .select('medication_name')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (prescriptionError || !prescriptions || prescriptions.length < 2) {
        return result; // Need at least 2 drugs to check interactions
      }

      // Get RxCUIs for all prescriptions
      const drugsWithRxCUI: Array<{ name: string; rxcui: string }> = [];
      
      for (const prescription of prescriptions) {
        const rxcui = await getRxCUI(prescription.medication_name);
        if (rxcui) {
          drugsWithRxCUI.push({
            name: prescription.medication_name,
            rxcui,
          });
        }
      }

      if (drugsWithRxCUI.length < 2) {
        return result;
      }

      const allRxCUIs = drugsWithRxCUI.map(d => d.rxcui);
      const interactionData = await checkInteractionsBetweenDrugs(allRxCUIs);

      if (!interactionData?.fullInteractionTypeGroup) {
        return result;
      }

      // Parse interactions
      for (const group of interactionData.fullInteractionTypeGroup) {
        for (const interactionType of group.fullInteractionType || []) {
          for (const pair of interactionType.interactionPair || []) {
            const description = pair.description || 'Potential interaction detected';
            const severity = parseSeverity(pair.severity);
            
            const drugs = pair.interactionConcept?.map(
              c => c.minConceptItem?.name || 'Unknown'
            ) || [];

            result.interactions.push({
              severity,
              description,
              drug1: drugs[0] || 'Unknown',
              drug2: drugs[1] || 'Unknown',
            });
          }
        }
      }

      result.hasInteractions = result.interactions.length > 0;
    } catch (err) {
      console.error('Error checking all interactions:', err);
      setError('Failed to check drug interactions');
    } finally {
      setIsChecking(false);
    }

    return result;
  }, []);

  return {
    isChecking,
    error,
    checkInteractionsWithPrescriptions,
    checkAllPrescriptionInteractions,
  };
};
