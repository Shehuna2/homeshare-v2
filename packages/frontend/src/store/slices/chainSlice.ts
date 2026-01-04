import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Chain } from '../../types/chain';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from '../../config/chains.config';

interface ChainState {
  activeChainId: number;
  supportedChains: { [chainId: number]: Chain };
  isConnected: boolean;
}

const initialState: ChainState = {
  activeChainId: DEFAULT_CHAIN_ID,
  supportedChains: SUPPORTED_CHAINS,
  isConnected: false,
};

const chainSlice = createSlice({
  name: 'chain',
  initialState,
  reducers: {
    setActiveChain: (state, action: PayloadAction<number>) => {
      state.activeChainId = action.payload;
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
  },
});

export const { setActiveChain, setConnected } = chainSlice.actions;
export default chainSlice.reducer;
