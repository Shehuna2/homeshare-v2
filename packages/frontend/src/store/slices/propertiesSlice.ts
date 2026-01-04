import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Property } from '../../types/property';

interface PropertiesState {
  properties: Property[];
  loading: boolean;
  error: string | null;
}

const initialState: PropertiesState = {
  properties: [],
  loading: false,
  error: null,
};

const propertiesSlice = createSlice({
  name: 'properties',
  initialState,
  reducers: {
    setProperties: (state, action: PayloadAction<Property[]>) => {
      state.properties = action.payload;
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    addProperty: (state, action: PayloadAction<Property>) => {
      state.properties.push(action.payload);
    },
  },
});

export const { setProperties, setLoading, setError, addProperty } = propertiesSlice.actions;
export default propertiesSlice.reducer;
