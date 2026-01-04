import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Token, TokenBalance, TokenPrice } from '../../types/token';

interface TokenState {
  tokens: Token[];
  balances: TokenBalance[];
  prices: { [address: string]: TokenPrice };
  loading: boolean;
  error: string | null;
}

const initialState: TokenState = {
  tokens: [],
  balances: [],
  prices: {},
  loading: false,
  error: null,
};

const tokenSlice = createSlice({
  name: 'token',
  initialState,
  reducers: {
    setTokens: (state, action: PayloadAction<Token[]>) => {
      state.tokens = action.payload;
    },
    setBalances: (state, action: PayloadAction<TokenBalance[]>) => {
      state.balances = action.payload;
    },
    setPrices: (state, action: PayloadAction<{ [address: string]: TokenPrice }>) => {
      state.prices = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { setTokens, setBalances, setPrices, setLoading, setError } = tokenSlice.actions;
export default tokenSlice.reducer;
