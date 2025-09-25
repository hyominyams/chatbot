"use client";

import { FormEvent, useState } from "react";

const classes = ["5-1", "5-2", "6-1", "6-2"];

export default function LoginForm() {
  const [klass, setKlass] = useState(classes[0]);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log({ klass, nickname, password });
    // TODO: connect to POST /api/login
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-100 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          ClassCoder 로그인
        </h1>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700">
            <span className="mb-2 block">학급 선택</span>
            <select
              value={klass}
              onChange={(event) => setKlass(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {classes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            <span className="mb-2 block">닉네임</span>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="닉네임을 입력하세요"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            <span className="mb-2 block">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="비밀번호를 입력하세요"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-400 py-3 font-semibold text-white transition-colors hover:bg-blue-500"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
