import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { apiRequest } from '../services/api';
import CountryCodePicker from './CountryCodePicker';

const Login = ({ onSwitch }) => {
  const { login } = useContext(AuthContext);
  const [authMode, setAuthMode] = useState('password');
  const [countryCode, setCountryCode] = useState('+91');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState('');
  const [otpDevHint, setOtpDevHint] = useState('');
  const [otpDeliveryProvider, setOtpDeliveryProvider] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizedLocalMobile = mobileNumber.replace(/\D/g, '').slice(0, 12);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      
      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRequestOtp = async () => {
    try {
      setOtpLoading(true);
      setError(null);
      setOtpInfo('');
      const fullMobileNumber = `${countryCode}${normalizedLocalMobile}`;
      const data = await apiRequest('/api/auth/mobile/request-otp', {
        method: 'POST',
        body: { mobileNumber: fullMobileNumber },
      });
      setOtpRequested(true);
      setOtpExpiresAt(data.expiresAt || '');
      setOtpDevHint(data.devOtp || '');
      setOtpDeliveryProvider(data.deliveryProvider || '');
      if (data.deliveryProvider === 'mock') {
        setOtpInfo('Server is currently using MOCK OTP provider. Real SMS may not be delivered in this mode.');
      } else {
        setOtpInfo('OTP requested successfully. Please check your SMS inbox.');
      }
    } catch (err) {
      const msg = String(err.message || 'Failed to request OTP.');
      if (msg.toLowerCase().includes('mock otp provider is disabled')) {
        setError('OTP delivery is not configured on server yet. Ask admin to set OTP_PROVIDER=twilio and Twilio credentials.');
      } else {
        setError(msg);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setOtpLoading(true);
      setError(null);
      const fullMobileNumber = `${countryCode}${normalizedLocalMobile}`;
      const data = await apiRequest('/api/auth/mobile/verify-otp', {
        method: 'POST',
        body: { mobileNumber: fullMobileNumber, otp },
      });
      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await apiRequest('/api/auth/google', {
        method: 'POST',
        body: { credential: credentialResponse.credential },
      });
      
      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="glass-panel w-full p-8 md:p-10">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Welcome Back</h2>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-5 bg-slate-900/50 rounded-lg p-1 border border-slate-700/60">
        <button
          type="button"
          className={`rounded-md py-2 text-sm font-medium transition-all ${authMode === 'password' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'text-slate-300'}`}
          onClick={() => setAuthMode('password')}
        >
          Password Login
        </button>
        <button
          type="button"
          className={`rounded-md py-2 text-sm font-medium transition-all ${authMode === 'otp' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'text-slate-300'}`}
          onClick={() => setAuthMode('otp')}
        >
          Mobile OTP Login
        </button>
      </div>
      
      {authMode === 'password' ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
            <input
              type="text"
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <input
              type="password"
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-400 hover:to-blue-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-500/20 transform hover:-translate-y-0.5 transition-all active:translate-y-0 mt-2"
          >
            Login
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mobile Number</label>
            <div className="flex items-center gap-2">
              <CountryCodePicker
                value={countryCode}
                onChange={(nextCode) => {
                  setCountryCode(nextCode);
                  setOtpRequested(false);
                  setOtp('');
                  setOtpInfo('');
                  setOtpDevHint('');
                }}
                helperText="Country code defaults to India and can be searched/changed from dropdown."
              />
              <input
                type="tel"
                inputMode="numeric"
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                value={normalizedLocalMobile}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setMobileNumber(digits);
                }}
                placeholder="Enter mobile number"
              />
            </div>
          </div>

          {otpRequested && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">OTP Code</label>
              <input
                type="text"
                maxLength={6}
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-3 tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={otpLoading || normalizedLocalMobile.length < 6}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-100 font-semibold py-3 rounded-lg border border-slate-600/70 transition-all"
            >
              {otpLoading ? 'Requesting…' : otpRequested ? 'Resend OTP' : 'Request OTP'}
            </button>
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={otpLoading || !otpRequested || otp.length !== 6}
              className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-400 hover:to-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-500/20 transition-all"
            >
              {otpLoading ? 'Verifying…' : 'Verify & Login'}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            OTP expires in a few minutes{otpExpiresAt ? ` (until ${new Date(otpExpiresAt).toLocaleTimeString()})` : ''}.
          </p>
          {otpDeliveryProvider && (
            <p className="text-xs text-slate-400">Delivery provider: <span className="uppercase font-semibold text-slate-300">{otpDeliveryProvider}</span></p>
          )}
          {otpInfo && (
            <p className={`text-xs ${otpDeliveryProvider === 'mock' ? 'text-amber-300' : 'text-emerald-300'}`}>{otpInfo}</p>
          )}
          {otpDevHint && (
            <p className="text-xs text-amber-300">
              Dev OTP: <span className="font-semibold tracking-[0.2em]">{otpDevHint}</span>
            </p>
          )}
        </div>
      )}
      
      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-slate-700/50"></div>
        <span className="px-4 text-sm text-slate-500">Or continue with</span>
        <div className="flex-1 border-t border-slate-700/50"></div>
      </div>

      <div className="flex justify-center mb-6">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google Login Failed')}
          theme="filled_black"
          shape="rectangular"
          text="signin_with"
        />
      </div>
      
      <div className="mt-6 text-center text-sm text-slate-400">
        Don't have an account?{' '}
        <button 
          onClick={onSwitch} 
          className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors focus:outline-none"
        >
          Sign up
        </button>
      </div>
    </div>
  );
};

export default Login;
