// Animated explainer: favorite pros, reviews and loyalty points (customers).
module.exports = {
  key: 'favorites', title: 'Favorite pros, reviews and points', tagline: 'Book good pros again, and help others choose', topic: 'Customers', audience: 'all',
  scenes: [
    { kind: 'title', icon: 'heart', title: 'Favorite pros, **reviews** and **points**', sub: 'Book good pros again, and help others choose.',
      beats: ['This video shows how to save pros you like, how to write a helpful review, and how loyalty points work.'] },
    { kind: 'phone', n: '1', h: 'Save your **favorite** pros', points: [{ b: 0, icon: 'heart', t: 'Tap ♡ on a pro' }, { b: 1, icon: 'users', t: 'Open **Favorite Pros**' }, { b: 2, icon: 'calendar', t: 'Book them again in a tap' }],
      rows: [{ k: 'card', icon: 'user', t: 'Marcus T. · Plumbing', sub: '★ 4.9 · 86 jobs done', right: '♥', tap: 0 }, { k: 'head', t: 'Favorite Pros', b: 1 }, { k: 'card', icon: 'user', t: 'Marcus T.', sub: 'Plumbing', b: 1 }, { k: 'card', icon: 'user', t: 'Grace W.', sub: 'Cleaning', b: 1 }, { k: 'button', t: 'Book', b: 2, tap: 2 }],
      beats: ['When you find a pro you like, tap the heart on their profile.', 'They are saved in Favorite Pros, in your account.', 'Next time, open Favorite Pros, and book them again in a tap.'] },
    { kind: 'list', h: 'Write a **helpful** review', items: [{ icon: 'star', t: 'Stars: 1 to 5', sub: 'How good was the work?' }, { icon: 'chat', t: 'A few **honest** words', sub: 'Was it on time? Clean? The price as agreed?' }, { icon: 'shield', t: '"Do you **trust** this pro?"', sub: 'Yes or no. It counts in their Trothen Score.' }],
      beats: ['After a job is complete, you can review the pro. Only people who really booked the pro can review them.', 'Give stars, from 1 to 5: how good was the work?', 'Write a few honest words. Was the pro on time? Did they clean up? Was the price as agreed? These help other customers most.', 'Then answer: do you trust this pro? Yes or no. Your answer counts in the pro\'s Trothen Score.'] },
    { kind: 'list', h: 'Loyalty **points**', items: [{ icon: 'calendar', t: 'A point for each **booking**' }, { icon: 'star', t: 'A point for each **review**' }, { icon: 'users', t: 'A point when a friend joins with your link' }, { icon: 'refresh', t: 'Points spent on a booking that is cancelled come **back**' }],
      beats: ['And loyalty points.', 'You earn a point for each booking.', 'A point for each review.', 'And a point when a friend joins Trothen with your referral link.', 'You can use points on a booking. If that booking is cancelled, declined, or runs out, your points come back.'] },
    { kind: 'end', title: 'Good pros, **again**', sub: 'Stuck? Tap Help videos, or ask us in the support chat.', beats: ['That is all. Save the pros you like, and review honestly. It makes Trothen better for everyone.'] },
  ],
};
