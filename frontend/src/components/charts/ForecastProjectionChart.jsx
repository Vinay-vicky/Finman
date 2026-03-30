import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const ForecastProjectionChart = ({ data = [], formatter }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="monthOffset" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip formatter={(value) => formatter(value)} />
        <Line type="monotone" dataKey="projectedBalance" stroke="#34d399" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default ForecastProjectionChart;
