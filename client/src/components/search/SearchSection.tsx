import { useState } from 'react';

const SearchSection = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div>
      <input
        type="text"
        placeholder="Search photos..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <button onClick={() => console.log('Search')}>Search</button>
      {/* Add more UI elements as needed */}
    </div>
  );
};

export default SearchSection;
