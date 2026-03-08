import { executeRequest, loadCatalog, loadHealth, setHeroTerminal, setSelectedEndpoint, testAPI, updatePaymentModule, copyGatewayAddress, closeModal, renderCatalog } from './catalog';
import { getElement } from './dom';
import { applyStaticTranslations, syncLanguageUrl, t } from './i18n';
import { state, LANGUAGE_STORAGE_KEY, type Language } from './state';
import { closeWalletModal, connectDemo, connectWallet, getWalletErrorMessage, getWalletModeDescription, openWalletModal, updateWalletUI } from './wallet';

function setLanguage(language: Language) {
  state.currentLanguage = language;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  syncLanguageUrl(language);
  applyStaticTranslations();
  updatePaymentModule();
  if (state.catalog) {
    renderCatalog(state.catalog.endpoints);
    setSelectedEndpoint(state.selectedEndpoint || state.catalog.endpoints[0] || null);
  }
  if (state.walletConnected) {
    updateWalletUI();
  }
}

function bindEvents() {
  getElement<HTMLButtonElement>('languageToggle').addEventListener('click', () => {
    setLanguage(state.currentLanguage === 'zh' ? 'en' : 'zh');
  });

  getElement<HTMLButtonElement>('copyReceiverButton').addEventListener('click', () => {
    void copyGatewayAddress();
  });

  getElement<HTMLButtonElement>('connectWallet').addEventListener('click', () => {
    if (state.walletConnected) {
      window.alert(
        t('dynamic.walletConnectedAlert', {
          address: state.walletAddress,
          walletType: state.walletType,
          modeDescription: getWalletModeDescription(state.walletType),
        }),
      );
      return;
    }

    openWalletModal();
  });

  document.querySelectorAll<HTMLElement>('[data-wallet-type]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.getAttribute('data-wallet-state') === 'pending') {
        const pendingType =
          button.dataset.walletType === 'coinbase'
            ? 'Coinbase Wallet'
            : button.dataset.walletType === 'metamask'
              ? 'MetaMask'
              : 'Wallet';
        window.alert(t('dynamic.walletInDevelopment', { walletType: pendingType }));
        return;
      }

      const walletTypeValue = button.dataset.walletType;
      if (walletTypeValue === 'coinbase' || walletTypeValue === 'metamask' || walletTypeValue === 'rabby') {
        void connectWallet(walletTypeValue).catch((error) => {
          window.alert(getWalletErrorMessage(error));
        });
      }
    });
  });

  document.querySelectorAll<HTMLElement>('[data-demo-connect]').forEach((button) => {
    button.addEventListener('click', connectDemo);
  });

  document.querySelectorAll<HTMLElement>('[data-close-wallet-modal]').forEach((button) => {
    button.addEventListener('click', closeWalletModal);
  });

  document.querySelectorAll<HTMLElement>('[data-close-api-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  getElement<HTMLButtonElement>('sendRequest').addEventListener('click', () => {
    void executeRequest();
  });

  getElement<HTMLDivElement>('apiModal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  });

  getElement<HTMLDivElement>('walletModal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      closeWalletModal();
    }
  });

  getElement<HTMLDivElement>('catalogGrid').addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const card = target?.closest<HTMLElement>('[data-endpoint-path]');
    if (!card?.dataset.endpointPath || !state.catalog) {
      return;
    }

    const endpoint = state.catalog.endpoints.find((item) => item.path === card.dataset.endpointPath);
    setSelectedEndpoint(endpoint || state.catalog.endpoints[0] || null);
  });
}

export function startApp() {
  applyStaticTranslations();
  updatePaymentModule();
  setHeroTerminal(null);
  bindEvents();
  void loadHealth();
  void loadCatalog();
}
