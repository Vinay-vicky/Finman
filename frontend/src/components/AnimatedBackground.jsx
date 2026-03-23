import React from 'react';

const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-slate-950">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/20 blur-[120px]"></div>
      
      {/* Floating Elements */}
      <div className="absolute top-[20%] left-[10%] text-6xl text-emerald-500/10 animate-floating-rupee font-bold">₹</div>
      <div className="absolute top-[60%] left-[80%] text-7xl text-blue-500/10 animate-floating-slow font-bold" style={{ animationDelay: '1s' }}>₹</div>
      
      <div className="absolute top-[80%] left-[25%] text-5xl text-emerald-400/10 animate-floating-rupee font-bold" style={{ animationDelay: '2.5s' }}>$</div>
      
      {/* Abstract Shapes */}
      <div className="absolute top-[30%] left-[70%] w-24 h-24 border-4 border-slate-700/20 rounded-full animate-floating-slow" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute top-[75%] left-[15%] w-16 h-16 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-lg rotate-45 animate-floating-rupee" style={{ animationDelay: '3s' }}></div>
      
      <div className="absolute top-[10%] left-[50%] text-4xl text-emerald-600/10 animate-floating-slow font-bold" style={{ animationDelay: '1.5s' }}>€</div>
      <div className="absolute top-[40%] left-[40%] text-8xl text-slate-500/5 animate-floating-rupee font-bold" style={{ animationDelay: '4s' }}>₹</div>
    </div>
  );
};

export default AnimatedBackground;
