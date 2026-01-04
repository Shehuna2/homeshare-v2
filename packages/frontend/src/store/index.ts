import { configureStore } from '@reduxjs/toolkit';
import chainReducer from './slices/chainSlice';
import userReducer from './slices/userSlice';
import propertiesReducer from './slices/propertiesSlice';
import investmentReducer from './slices/investmentSlice';
import tokenReducer from './slices/tokenSlice';

export const store = configureStore({
  reducer: {
    chain: chainReducer,
    user: userReducer,
    properties: propertiesReducer,
    investment: investmentReducer,
    token: tokenReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
