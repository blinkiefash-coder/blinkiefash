import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MdArrowBack, MdSend } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { getSupportTickets, submitSupportTicket } from '../api';
import PageSEO from '../components/PageSEO';
import './Complain.css';

const CATEGORIES = ['Delivery issue', 'Damaged item', 'Wrong item', 'Missing item', 'Refund issue', 'Other'];

export default function Complain() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { user, isLoggedIn } = useAuth();
	const [category, setCategory] = useState(CATEGORIES[0]);
	const [message, setMessage] = useState('');
	const [tickets, setTickets] = useState([]);
	const [loading, setLoading] = useState(() => Boolean(isLoggedIn && user?.id));
	const [submitting, setSubmitting] = useState(false);
	const [feedback, setFeedback] = useState('');
	const [error, setError] = useState('');
	const orderId = searchParams.get('orderId') || '';

	useEffect(() => {
		if (!isLoggedIn || !user?.id) return;
		let cancelled = false;
		getSupportTickets(user.id)
			.then((res) => {
				if (!cancelled) setTickets(res.tickets || []);
			})
			.catch((err) => {
				if (!cancelled) setError(err.message || 'Could not load complaints');
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => { cancelled = true; };
	}, [isLoggedIn, user?.id]);

	const handleSubmit = async (event) => {
		event.preventDefault();
		if (!user?.id || !message.trim()) {
			setError('Please describe your complaint.');
			return;
		}
		setSubmitting(true);
		setError('');
		setFeedback('');
		try {
			const res = await submitSupportTicket({
				user_id: user.id,
				order_id: orderId || null,
				category,
				message: message.trim(),
			});
			if (!res.success) throw new Error(res.error || res.message || 'Could not submit complaint');
			setMessage('');
			setFeedback('Your complaint has been submitted.');
			const refreshed = await getSupportTickets(user.id);
			setTickets(refreshed.tickets || []);
		} catch (err) {
			setError(err.message || 'Could not submit complaint');
		} finally {
			setSubmitting(false);
		}
	};

	if (!isLoggedIn) {
		return (
			<main className="complain-page">
				<PageSEO title="Complaints" description="Raise a complaint about your Blinkiefash order." path="/complain" noIndex />
				<button type="button" className="complain-back" onClick={() => navigate('/orders')}><MdArrowBack /> Orders</button>
				<section className="complain-card complain-empty">
					<h1>Raise a complaint</h1>
					<p>Please log in to submit and view your complaints.</p>
				</section>
			</main>
		);
	}

	return (
		<main className="complain-page">
			<PageSEO title="Complaints" description="Raise a complaint about your Blinkiefash order." path="/complain" noIndex />
			<button type="button" className="complain-back" onClick={() => navigate('/orders')}><MdArrowBack /> Orders</button>
			<header className="complain-header">
				<h1>Raise a complaint</h1>
				<p>Tell us what went wrong and our team will review it.</p>
			</header>

			<section className="complain-card">
				<form onSubmit={handleSubmit} className="complain-form">
					<label>
						Order
						<input value={orderId ? `#${orderId.slice(-8).toUpperCase()}` : 'General complaint'} readOnly />
					</label>
					<label>
						Issue type
						<select value={category} onChange={(event) => setCategory(event.target.value)}>
							{CATEGORIES.map((item) => <option key={item}>{item}</option>)}
						</select>
					</label>
					<label>
						Describe the issue
						<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder="Tell us what happened..." required />
					</label>
					<button type="submit" className="complain-submit" disabled={submitting}>
						<MdSend /> {submitting ? 'Submitting...' : 'Submit complaint'}
					</button>
				</form>
				{feedback && <p className="complain-success">{feedback}</p>}
				{error && <p className="complain-error">{error}</p>}
			</section>

			<section className="complain-card">
				<h2>Previous complaints</h2>
				{loading ? <p className="complain-muted">Loading...</p> : tickets.length === 0 ? (
					<p className="complain-muted">No complaints submitted yet.</p>
				) : (
					<div className="complain-list">
						{tickets.map((ticket) => (
							<article key={ticket.id} className="complain-item">
								<div><strong>{ticket.category}</strong><span>{ticket.status}</span></div>
								<p>{ticket.message}</p>
								<small>{ticket.created_at ? new Date(ticket.created_at).toLocaleString('en-IN') : ''}</small>
							</article>
						))}
					</div>
				)}
			</section>
		</main>
	);
}
