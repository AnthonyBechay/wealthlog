import { useState } from "react";
import { useRouter } from "next/router";
import { api } from "@wealthlog/common";

export default function Register() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [roleName, setRoleName] = useState("MEMBER");
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/register", {
        username,
        email,
        password,
        firstName,
        lastName,
        phone,
        dateOfBirth,
        securityQuestion,
        securityAnswer,
        roleName,
      });
      // After successful registration, redirect to login
      router.push("/login");
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        "Registration failed. Please try again or use a different username/email."
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-lg bg-white rounded-lg shadow p-6">
        <h2 className="text-3xl font-extrabold text-center text-gray-800">
          Create an Account
        </h2>
        <p className="text-center text-gray-500 mt-1">
          Get started with your WealthLog!
        </p>

        {error && (
          <div className="text-red-600 bg-red-50 p-2 rounded mt-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          {/* Username + Email */}
          <div>
            <label className="block font-semibold text-gray-700">Username</label>
            <input
              type="text"
              className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700">Email</label>
            <input
              type="email"
              className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block font-semibold text-gray-700">Password</label>
            <input
              type="password"
              className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* First & Last Name */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block font-semibold text-gray-700">First Name</label>
              <input
                type="text"
                className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <label className="block font-semibold text-gray-700">Last Name</label>
              <input
                type="text"
                className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Phone + DOB (optional) */}
          <div>
            <label className="block font-semibold text-gray-700">Phone (Optional)</label>
            <input
              type="tel"
              className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700">Date of Birth (Optional)</label>
            <input
              type="date"
              className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          {/* Security Q/A (optional) */}
          <div>
            <label className="block font-semibold text-gray-700">Security Question (Optional)</label>
            <input
              type="text"
              className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700">Security Answer (Optional)</label>
            <input
              type="text"
              className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
            />
          </div>

          {/* Role */}
          <div>
            <label className="block font-semibold text-gray-700">Role</label>
            <select
              className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring focus:ring-blue-300"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            >
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 transition"
          >
            Register
          </button>
        </form>

        <p className="mt-4 text-center text-gray-600">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
