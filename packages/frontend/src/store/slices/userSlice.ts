import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  address: string | null;
  isAuthenticated: boolean;
  isOwner: boolean;
}

const initialState: UserState = {
  address: null,
  isAuthenticated: false,
  isOwner: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<{ address: string; isOwner: boolean }>) => {
      state.address = action.payload.address;
      state.isAuthenticated = true;
      state.isOwner = action.payload.isOwner;
    },
    clearUser: (state) => {
      state.address = null;
      state.isAuthenticated = false;
      state.isOwner = false;
    },
  },
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
