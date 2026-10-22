import { describe, expect, it } from 'vitest';
import { bpsToPct, journalTag, journalText, pctToBps, phoneText, settingText } from './format';

describe('console : formats', () => {
  it('pourcentages ↔ points de base', () => {
    expect(bpsToPct('800')).toBe('8 %');
    expect(bpsToPct(825)).toBe('8,25 %');
    expect(pctToBps('7,5')).toBe('750');
    expect(pctToBps('7.25 %')).toBe('725');
    expect(pctToBps('100')).toBe('10000');
    expect(pctToBps('101')).toBeNull();
    expect(pctToBps('abc')).toBeNull();
    expect(pctToBps('')).toBeNull();
  });
  it('valeurs de paramètres lisibles', () => {
    expect(settingText('payment_mode', 'orange_money')).toBe('Orange Money');
    expect(settingText('commission_bps', '700')).toBe('7 %');
  });
  it('phrases du journal', () => {
    expect(journalText({ action: 'parametre_modifie', target_id: 'commission_bps', detail: { avant: '800', apres: '700' } })).toBe('Commission Hailand : 8 % → 7 %');
    expect(journalText({ action: 'boutique_statut', target_id: 'x', detail: { nom: 'Kadi Wax', avant: 'ouverte', apres: 'suspendue' } })).toBe('Boutique « Kadi Wax » : ouverte → suspendue');
    expect(journalText({ action: 'certification_transmise', target_id: 'x', detail: { boutique: 'Kadi Wax' } })).toBe('Certification « Kadi Wax » confirmée, transmise à HailandMap');
    expect(journalText({ action: 'litige_tranche', target_id: 'x', detail: { resolution: 'acheteur' } })).toContain('en faveur de l’acheteur');
    expect(journalText({ action: 'action_inconnue', target_id: null, detail: {} })).toBe('action inconnue');
    expect(journalTag({ action: 'versement_vendeur', target_type: 'boutique' })).toBe('Argent');
    expect(journalTag({ action: 'boutique_statut', target_type: 'boutique' })).toBe('Boutique');
    expect(journalText({ action: 'question_masquee', target_id: 'q', detail: { question: 'Votre numéro ?' } })).toBe('Question masquée sur une fiche produit : « Votre numéro ? »');
    expect(journalTag({ action: 'question_masquee', target_type: 'question' })).toBe('Question');
  });
  it('numéro lisible', () => {
    expect(phoneText('224612345678')).toBe('+224 612 34 56 78');
    expect(phoneText(null)).toBe('—');
  });
});
