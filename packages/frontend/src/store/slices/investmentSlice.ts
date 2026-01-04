import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Investment, InvestmentSummary } from '../../types/investment';

interface InvestmentState {
  investments: Investment[];
  summary: InvestmentSummary | null;
  loading: boolean;
  error: string | null;
}

const initialState: InvestmentState = {
  investments: [],
  summary: null,
  loading: false,
  error: null,
};

const investmentSlice = createSlice({
  name: 'investment',
  initialState,
  reducers: {
    setInvestments: (state, action: PayloadAction<Investment[]>) => {
      state.investments = action.payload;
      state.loading = false;
      state.error = null;
    },
    setSummary: (state, action: PayloadAction<InvestmentSummary>) => {
      state.summary = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    addInvestment: (state, action: PayloadAction<Investment>) => {
      state.investments.push(action.payload);
    },
  },
});

export const { setInvestments, setSummary, setLoading, setError, addInvestment } = investmentSlice.actions;
export default investmentSlice.reducer;
